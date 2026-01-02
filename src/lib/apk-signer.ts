/**
 * APK Signing Module
 * 
 * Implements JAR signing (v1 signature) for Android APK files.
 * This creates proper MANIFEST.MF, CERT.SF, and CERT.RSA files.
 */

import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

// Initialize PKI.js crypto engine
const cryptoEngine = new pkijs.CryptoEngine({
  name: 'webcrypto',
  crypto: crypto,
});
pkijs.setEngine('webcrypto', crypto, cryptoEngine);

export interface SigningKey {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  certificate: pkijs.Certificate;
}

/**
 * Generate a self-signed certificate and key pair for APK signing
 */
export async function generateSigningKey(): Promise<SigningKey> {
  // Generate RSA key pair
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  // Create certificate
  const certificate = new pkijs.Certificate();
  
  // Set version to v3
  certificate.version = 2;
  
  // Generate random serial number
  const serialNumber = new Uint8Array(8);
  crypto.getRandomValues(serialNumber);
  certificate.serialNumber = new asn1js.Integer({ valueHex: serialNumber.buffer as ArrayBuffer });
  
  // Set issuer and subject
  const commonName = new pkijs.AttributeTypeAndValue({
    type: '2.5.4.3', // Common Name OID
    value: new asn1js.Utf8String({ value: 'APK Debug Key' }),
  });
  
  const organizationName = new pkijs.AttributeTypeAndValue({
    type: '2.5.4.10', // Organization Name OID
    value: new asn1js.Utf8String({ value: 'Debug' }),
  });

  certificate.issuer.typesAndValues.push(commonName);
  certificate.issuer.typesAndValues.push(organizationName);
  certificate.subject.typesAndValues.push(commonName);
  certificate.subject.typesAndValues.push(organizationName);
  
  // Set validity (10 years)
  const notBefore = new Date();
  const notAfter = new Date();
  notAfter.setFullYear(notAfter.getFullYear() + 10);
  
  certificate.notBefore.value = notBefore;
  certificate.notAfter.value = notAfter;
  
  // Set public key
  await certificate.subjectPublicKeyInfo.importKey(keyPair.publicKey);
  
  // Set signature algorithm
  certificate.signatureAlgorithm.algorithmId = '1.2.840.113549.1.1.11'; // SHA-256 with RSA
  
  // Add basic constraints extension
  const basicConstraints = new pkijs.BasicConstraints({
    cA: false,
  });
  
  certificate.extensions = [];
  certificate.extensions.push(
    new pkijs.Extension({
      extnID: '2.5.29.19', // Basic Constraints OID
      critical: true,
      extnValue: basicConstraints.toSchema().toBER(false),
    })
  );
  
  // Add key usage extension
  const keyUsage = new asn1js.BitString({
    valueHex: new Uint8Array([0x05, 0xa0]).buffer as ArrayBuffer, // digitalSignature
  });
  
  certificate.extensions.push(
    new pkijs.Extension({
      extnID: '2.5.29.15', // Key Usage OID
      critical: true,
      extnValue: keyUsage.toBER(false),
    })
  );
  
  // Sign the certificate
  await certificate.sign(keyPair.privateKey, 'SHA-256');
  
  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    certificate,
  };
}

/**
 * Create MANIFEST.MF content
 */
export async function createManifestMF(
  files: Map<string, ArrayBuffer>
): Promise<string> {
  let manifest = 'Manifest-Version: 1.0\r\n';
  manifest += 'Created-By: 1.0 (APK Debugger)\r\n';
  manifest += '\r\n';
  
  // Sort files for consistent output
  const sortedFiles = Array.from(files.keys()).sort();
  
  for (const name of sortedFiles) {
    // Skip META-INF files
    if (name.startsWith('META-INF/')) continue;
    
    const data = files.get(name)!;
    const hash = await sha256Base64(data);
    
    // Format the entry with line wrapping at 70 characters
    const entry = formatManifestEntry(name, hash);
    manifest += entry;
  }
  
  return manifest;
}

/**
 * Create CERT.SF (signature file) content
 */
export async function createCertSF(
  manifestMF: string,
  files: Map<string, ArrayBuffer>
): Promise<string> {
  // Hash the entire manifest
  const manifestBytes = new TextEncoder().encode(manifestMF);
  const manifestHash = await sha256Base64(manifestBytes.buffer as ArrayBuffer);
  
  let sf = 'Signature-Version: 1.0\r\n';
  sf += `SHA-256-Digest-Manifest: ${manifestHash}\r\n`;
  sf += 'Created-By: 1.0 (APK Debugger)\r\n';
  sf += '\r\n';
  
  // For each entry in manifest, compute the hash of the entry block
  const lines = manifestMF.split('\r\n');
  let currentEntry = '';
  let currentName = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('Name: ')) {
      currentName = line.substring(6);
      currentEntry = line + '\r\n';
    } else if (line.startsWith(' ')) {
      // Continuation line
      currentEntry += line + '\r\n';
    } else if (line.startsWith('SHA-256-Digest:') || line.startsWith('SHA256-Digest:')) {
      currentEntry += line + '\r\n';
    } else if (line === '' && currentName) {
      // End of entry
      currentEntry += '\r\n';
      const entryHash = await sha256Base64(new TextEncoder().encode(currentEntry).buffer as ArrayBuffer);
      sf += formatManifestEntry(currentName, entryHash, 'SHA-256-Digest');
      currentName = '';
      currentEntry = '';
    }
  }
  
  return sf;
}

/**
 * Create CERT.RSA (PKCS#7 signature block)
 */
export async function createCertRSA(
  certSF: string,
  signingKey: SigningKey
): Promise<ArrayBuffer> {
  const certSFBytes = new TextEncoder().encode(certSF);
  
  // Create PKCS#7 SignedData structure
  const cmsSigned = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({
      eContentType: '1.2.840.113549.1.7.1', // data
    }),
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({
          issuer: signingKey.certificate.issuer,
          serialNumber: signingKey.certificate.serialNumber,
        }),
      }),
    ],
    certificates: [signingKey.certificate],
  });
  
  // Sign the data
  await cmsSigned.sign(
    signingKey.privateKey,
    0, // signer index
    'SHA-256',
    certSFBytes
  );
  
  // Create ContentInfo wrapper
  const contentInfo = new pkijs.ContentInfo({
    contentType: '1.2.840.113549.1.7.2', // signedData
    content: cmsSigned.toSchema(true),
  });
  
  return contentInfo.toSchema().toBER(false);
}

/**
 * Format a manifest entry with proper line wrapping
 */
function formatManifestEntry(name: string, hash: string, digestName: string = 'SHA-256-Digest'): string {
  let entry = '';
  
  // Write name with line wrapping
  const nameLine = `Name: ${name}`;
  entry += wrapLine(nameLine);
  
  // Write digest with line wrapping
  const digestLine = `${digestName}: ${hash}`;
  entry += wrapLine(digestLine);
  
  entry += '\r\n';
  
  return entry;
}

/**
 * Wrap a line at 70 characters (JAR specification)
 */
function wrapLine(line: string): string {
  if (line.length <= 70) {
    return line + '\r\n';
  }
  
  let result = line.substring(0, 70) + '\r\n';
  let remaining = line.substring(70);
  
  while (remaining.length > 0) {
    const chunk = remaining.substring(0, 69);
    result += ' ' + chunk + '\r\n';
    remaining = remaining.substring(69);
  }
  
  return result;
}

/**
 * Compute SHA-256 hash and return as Base64
 */
async function sha256Base64(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Sign an APK with the given signing key
 */
export async function signApk(
  files: Map<string, ArrayBuffer>,
  signingKey: SigningKey
): Promise<{
  manifestMF: string;
  certSF: string;
  certRSA: ArrayBuffer;
}> {
  // Create MANIFEST.MF
  const manifestMF = await createManifestMF(files);
  
  // Create CERT.SF
  const certSF = await createCertSF(manifestMF, files);
  
  // Create CERT.RSA
  const certRSA = await createCertRSA(certSF, signingKey);
  
  return {
    manifestMF,
    certSF,
    certRSA,
  };
}
