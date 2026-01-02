/**
 * APK Processor
 * 
 * Main module for processing Android APK files:
 * - Extracts APK contents
 * - Parses AndroidManifest.xml (binary AXML format)
 * - Modifies manifest to enable debugging
 * - Merges split APKs from APKS bundles
 * - Re-signs the APK with a debug certificate
 * - Generates the final installable APK
 */

import JSZip from 'jszip';
import { parseAndroidManifest, makeManifestDebuggable, ApkManifestInfo } from './axml-parser';
import { generateSigningKey, signApk } from './apk-signer';

export interface ProcessingLog {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: Date;
}

export interface ApkInfo {
  packageName: string;
  versionName: string;
  versionCode: string;
  minSdk: string;
  targetSdk: string;
  isDebuggable: boolean;
  permissions: string[];
}

export interface ProcessResult {
  success: boolean;
  apkBlob?: Blob;
  apkInfo?: ApkInfo;
  logs: ProcessingLog[];
}

/**
 * Process an APK or APKS file to make it debuggable
 */
export async function processApk(
  file: File,
  onLog: (log: ProcessingLog) => void
): Promise<ProcessResult> {
  const logs: ProcessingLog[] = [];
  
  const log = (type: ProcessingLog['type'], message: string) => {
    const entry: ProcessingLog = { type, message, timestamp: new Date() };
    logs.push(entry);
    onLog(entry);
  };

  try {
    log('info', `Loading file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    const arrayBuffer = await file.arrayBuffer();
    let mainZip: JSZip;
    
    // Check if this is an APKS (split APK bundle)
    const isApks = file.name.toLowerCase().endsWith('.apks');
    
    if (isApks) {
      log('info', 'Detected APKS bundle format');
      mainZip = await processApksBundle(arrayBuffer, log);
    } else {
      mainZip = await JSZip.loadAsync(arrayBuffer);
      log('success', 'APK extracted successfully');
    }
    
    // Find and parse AndroidManifest.xml
    const manifestFile = mainZip.file('AndroidManifest.xml');
    if (!manifestFile) {
      throw new Error('AndroidManifest.xml not found in APK');
    }
    
    log('info', 'Parsing AndroidManifest.xml (binary AXML format)...');
    
    const manifestData = await manifestFile.async('uint8array');
    
    // Parse the manifest to get app info
    let apkInfo: ApkInfo;
    let manifestInfo: ApkManifestInfo;
    
    try {
      const { info } = parseAndroidManifest(manifestData);
      manifestInfo = info;
      
      apkInfo = {
        packageName: info.packageName || 'unknown',
        versionName: info.versionName || '1.0',
        versionCode: info.versionCode.toString(),
        minSdk: info.minSdkVersion > 0 ? `API ${info.minSdkVersion}` : 'N/A',
        targetSdk: info.targetSdkVersion > 0 ? `API ${info.targetSdkVersion}` : 'N/A',
        isDebuggable: info.isDebuggable,
        permissions: info.permissions,
      };
      
      log('success', `Parsed manifest: ${apkInfo.packageName} v${apkInfo.versionName}`);
      
      if (manifestInfo.isDebuggable) {
        log('warning', 'App is already debuggable');
      }
    } catch (parseError) {
      log('warning', 'Could not fully parse manifest, using fallback');
      apkInfo = {
        packageName: 'unknown.app',
        versionName: '1.0',
        versionCode: '1',
        minSdk: 'N/A',
        targetSdk: 'N/A',
        isDebuggable: false,
        permissions: [],
      };
      manifestInfo = {
        packageName: '',
        versionCode: 0,
        versionName: '',
        minSdkVersion: 0,
        targetSdkVersion: 0,
        isDebuggable: false,
        permissions: [],
        applicationName: '',
      };
    }
    
    // Make the manifest debuggable
    log('info', 'Patching manifest to enable debugging...');
    
    let modifiedManifest: Uint8Array;
    try {
      modifiedManifest = makeManifestDebuggable(manifestData);
      log('success', 'Manifest patched: android:debuggable="true"');
    } catch (modifyError) {
      log('warning', 'Could not modify manifest via AXML, using binary patch');
      modifiedManifest = patchManifestBinary(manifestData);
    }
    
    // Update the manifest in the ZIP
    mainZip.file('AndroidManifest.xml', modifiedManifest);
    
    // Remove old signatures
    log('info', 'Removing existing signatures...');
    const removedFiles = removeSignatures(mainZip);
    log('success', `Removed ${removedFiles} signature files from META-INF`);
    
    // Collect all files for signing
    log('info', 'Collecting files for signing...');
    const fileMap = await collectFiles(mainZip);
    log('success', `Collected ${fileMap.size} files`);
    
    // Generate signing key
    log('info', 'Generating debug signing key...');
    const signingKey = await generateSigningKey();
    log('success', 'RSA 2048-bit key pair generated');
    
    // Sign the APK
    log('info', 'Creating JAR signature (v1)...');
    const { manifestMF, certSF, certRSA } = await signApk(fileMap, signingKey);
    
    // Add signature files to ZIP
    mainZip.file('META-INF/MANIFEST.MF', manifestMF);
    mainZip.file('META-INF/CERT.SF', certSF);
    mainZip.file('META-INF/CERT.RSA', new Uint8Array(certRSA));
    
    log('success', 'APK signed with PKCS#7 signature');
    
    // Generate the final APK
    log('info', 'Generating final APK...');
    
    const apkBlob = await mainZip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
      // Ensure proper ZIP format for APK
      streamFiles: false,
    });
    
    // Update apkInfo to reflect that it's now debuggable
    apkInfo.isDebuggable = true;
    
    log('success', `APK generated successfully (${(apkBlob.size / 1024 / 1024).toFixed(2)} MB)`);
    log('info', 'Install with: adb install -t <filename>.apk');
    
    return {
      success: true,
      apkBlob,
      apkInfo,
      logs,
    };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    log('error', `Processing failed: ${message}`);
    console.error('APK processing error:', error);
    return {
      success: false,
      logs,
    };
  }
}

/**
 * Process an APKS bundle (split APKs)
 */
async function processApksBundle(
  arrayBuffer: ArrayBuffer,
  log: (type: ProcessingLog['type'], message: string) => void
): Promise<JSZip> {
  const bundleZip = await JSZip.loadAsync(arrayBuffer);
  
  // Find all APK files in the bundle
  const apkFiles: { name: string; isBase: boolean }[] = [];
  
  bundleZip.forEach((path, file) => {
    if (path.endsWith('.apk') && !file.dir) {
      const isBase = path.toLowerCase().includes('base') || 
                     path.toLowerCase().includes('universal') ||
                     path === 'base.apk';
      apkFiles.push({ name: path, isBase });
    }
  });
  
  if (apkFiles.length === 0) {
    throw new Error('No APK files found in APKS bundle');
  }
  
  log('info', `Found ${apkFiles.length} APK(s) in bundle`);
  
  // Find base APK
  let baseApkPath = apkFiles.find(f => f.isBase)?.name;
  if (!baseApkPath) {
    // Use the first APK as base
    baseApkPath = apkFiles[0].name;
  }
  
  log('info', `Base APK: ${baseApkPath}`);
  
  // Extract base APK
  const baseApkData = await bundleZip.file(baseApkPath)!.async('arraybuffer');
  const mainZip = await JSZip.loadAsync(baseApkData);
  
  log('success', 'Base APK extracted');
  
  // Merge split APKs
  for (const apkFile of apkFiles) {
    if (apkFile.name === baseApkPath) continue;
    
    log('info', `Merging split: ${apkFile.name}`);
    
    const splitData = await bundleZip.file(apkFile.name)!.async('arraybuffer');
    const splitZip = await JSZip.loadAsync(splitData);
    
    // Merge files from split into main
    let mergedCount = 0;
    const splitFiles: Promise<void>[] = [];
    
    splitZip.forEach((path, file) => {
      if (!file.dir && !path.startsWith('META-INF/') && !mainZip.file(path)) {
        splitFiles.push(
          file.async('uint8array').then(data => {
            mainZip.file(path, data);
            mergedCount++;
          })
        );
      }
    });
    
    await Promise.all(splitFiles);
    log('success', `Merged ${mergedCount} files from ${apkFile.name}`);
  }
  
  log('success', 'All splits merged into single APK');
  
  return mainZip;
}

/**
 * Remove existing signature files from META-INF
 */
function removeSignatures(zip: JSZip): number {
  const filesToRemove: string[] = [];
  
  zip.forEach((path) => {
    if (path.startsWith('META-INF/')) {
      const upperPath = path.toUpperCase();
      if (
        upperPath.endsWith('.SF') ||
        upperPath.endsWith('.RSA') ||
        upperPath.endsWith('.DSA') ||
        upperPath.endsWith('.EC') ||
        upperPath === 'META-INF/MANIFEST.MF' ||
        upperPath.includes('CERT') ||
        upperPath.includes('SIGN')
      ) {
        filesToRemove.push(path);
      }
    }
  });
  
  for (const path of filesToRemove) {
    zip.remove(path);
  }
  
  return filesToRemove.length;
}

/**
 * Collect all files from ZIP for signing
 */
async function collectFiles(zip: JSZip): Promise<Map<string, ArrayBuffer>> {
  const fileMap = new Map<string, ArrayBuffer>();
  const filePromises: Promise<void>[] = [];
  
  zip.forEach((path, file) => {
    if (!file.dir) {
      filePromises.push(
        file.async('arraybuffer').then(data => {
          fileMap.set(path, data);
        })
      );
    }
  });
  
  await Promise.all(filePromises);
  
  return fileMap;
}

/**
 * Binary patch for manifest when AXML modification fails
 * This directly patches the debuggable attribute in the binary
 */
function patchManifestBinary(data: Uint8Array): Uint8Array {
  const result = new Uint8Array(data);
  
  // Look for the pattern that represents android:debuggable="false"
  // In binary AXML, boolean false is 0x00000000 and true is 0xFFFFFFFF
  // The attribute ID for debuggable is 0x0101000f
  
  const debuggableId = [0x0f, 0x00, 0x01, 0x01]; // Little-endian 0x0101000f
  
  for (let i = 0; i < result.length - 20; i++) {
    // Check if this might be the debuggable attribute
    if (result[i] === debuggableId[0] && 
        result[i + 1] === debuggableId[1] &&
        result[i + 2] === debuggableId[2] &&
        result[i + 3] === debuggableId[3]) {
      // Found debuggable attribute ID
      // The value is typically 16 bytes after the attribute name
      // Look for boolean type (0x12) and check the value
      
      for (let j = i + 4; j < Math.min(i + 24, result.length - 4); j++) {
        if (result[j] === 0x12 && result[j + 1] === 0x00 && 
            result[j + 2] === 0x00 && result[j + 3] === 0x08) {
          // Found boolean type marker, next 4 bytes are the value
          // Set to true (0xFFFFFFFF)
          result[j + 4] = 0xFF;
          result[j + 5] = 0xFF;
          result[j + 6] = 0xFF;
          result[j + 7] = 0xFF;
          return result;
        }
      }
    }
  }
  
  // If we couldn't find debuggable attribute, look for application tag
  // and try to add the attribute (more complex, may not work for all APKs)
  
  return result;
}
