/**
 * Android Binary XML (AXML) Parser and Writer
 * 
 * This module provides full parsing and modification of Android's binary XML format.
 * The AXML format is used for AndroidManifest.xml and other compiled XML resources.
 * 
 * Binary XML Structure:
 * - Magic number (4 bytes): 0x00080003
 * - File size (4 bytes)
 * - String pool chunk
 * - Resource ID chunk (optional)
 * - XML content chunks (start/end namespace, start/end element, text)
 */

// Chunk types
const CHUNK_AXML_FILE = 0x00080003;
const CHUNK_STRING_POOL = 0x001C0001;
const CHUNK_RESOURCE_IDS = 0x00080180;
const CHUNK_XML_START_NAMESPACE = 0x00100100;
const CHUNK_XML_END_NAMESPACE = 0x00100101;
const CHUNK_XML_START_ELEMENT = 0x00100102;
const CHUNK_XML_END_ELEMENT = 0x00100103;
const CHUNK_XML_CDATA = 0x00100104;

// Attribute types
const TYPE_NULL = 0x00;
const TYPE_REFERENCE = 0x01;
const TYPE_ATTRIBUTE = 0x02;
const TYPE_STRING = 0x03;
const TYPE_FLOAT = 0x04;
const TYPE_DIMENSION = 0x05;
const TYPE_FRACTION = 0x06;
const TYPE_INT_DEC = 0x10;
const TYPE_INT_HEX = 0x11;
const TYPE_INT_BOOLEAN = 0x12;
const TYPE_INT_COLOR_ARGB8 = 0x1C;
const TYPE_INT_COLOR_RGB8 = 0x1D;
const TYPE_INT_COLOR_ARGB4 = 0x1E;
const TYPE_INT_COLOR_RGB4 = 0x1F;

// Android resource IDs
const ANDROID_NS = 'http://schemas.android.com/apk/res/android';
const ATTR_DEBUGGABLE = 0x0101000f;
const ATTR_PACKAGE = 0x01;
const ATTR_VERSION_CODE = 0x0101021b;
const ATTR_VERSION_NAME = 0x0101021c;

export interface AXMLAttribute {
  namespaceUri: number;
  name: number;
  valueString: number;
  type: number;
  data: number;
}

export interface AXMLElement {
  chunkType: number;
  lineNumber: number;
  comment: number;
  namespaceUri: number;
  name: number;
  attributes?: AXMLAttribute[];
  attributeStart?: number;
  attributeSize?: number;
  attributeCount?: number;
  idIndex?: number;
  classIndex?: number;
  styleIndex?: number;
}

export interface ParsedAXML {
  strings: string[];
  resourceIds: number[];
  elements: AXMLElement[];
  rawData: Uint8Array;
  stringPoolOffset: number;
  stringPoolSize: number;
  resourceIdsOffset: number;
  resourceIdsSize: number;
  elementsOffset: number;
}

export interface ApkManifestInfo {
  packageName: string;
  versionCode: number;
  versionName: string;
  minSdkVersion: number;
  targetSdkVersion: number;
  isDebuggable: boolean;
  permissions: string[];
  applicationName: string;
}

class DataReader {
  private data: DataView;
  private offset: number = 0;
  private littleEndian: boolean = true;

  constructor(buffer: ArrayBuffer | Uint8Array) {
    const arrayBuffer = buffer instanceof Uint8Array ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) : buffer;
    this.data = new DataView(arrayBuffer);
  }

  get position(): number {
    return this.offset;
  }

  set position(value: number) {
    this.offset = value;
  }

  get length(): number {
    return this.data.byteLength;
  }

  readUint8(): number {
    const value = this.data.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16(): number {
    const value = this.data.getUint16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }

  readUint32(): number {
    const value = this.data.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  readInt32(): number {
    const value = this.data.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.data.buffer, this.data.byteOffset + this.offset, length);
    this.offset += length;
    return new Uint8Array(bytes);
  }

  skip(bytes: number): void {
    this.offset += bytes;
  }

  getBuffer(): ArrayBuffer {
    return this.data.buffer as ArrayBuffer;
  }
}

class DataWriter {
  private buffer: ArrayBuffer;
  private data: DataView;
  private offset: number = 0;
  private littleEndian: boolean = true;

  constructor(size: number = 65536) {
    this.buffer = new ArrayBuffer(size);
    this.data = new DataView(this.buffer);
  }

  get position(): number {
    return this.offset;
  }

  set position(value: number) {
    this.offset = value;
  }

  ensureCapacity(needed: number): void {
    if (this.offset + needed > this.buffer.byteLength) {
      const newSize = Math.max(this.buffer.byteLength * 2, this.offset + needed);
      const newBuffer = new ArrayBuffer(newSize);
      new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
      this.buffer = newBuffer;
      this.data = new DataView(this.buffer);
    }
  }

  writeUint8(value: number): void {
    this.ensureCapacity(1);
    this.data.setUint8(this.offset, value);
    this.offset += 1;
  }

  writeUint16(value: number): void {
    this.ensureCapacity(2);
    this.data.setUint16(this.offset, value & 0xFFFF, this.littleEndian);
    this.offset += 2;
  }

  writeUint32(value: number): void {
    this.ensureCapacity(4);
    this.data.setUint32(this.offset, value >>> 0, this.littleEndian);
    this.offset += 4;
  }

  writeInt32(value: number): void {
    this.ensureCapacity(4);
    this.data.setInt32(this.offset, value, this.littleEndian);
    this.offset += 4;
  }

  writeBytes(bytes: Uint8Array): void {
    this.ensureCapacity(bytes.length);
    new Uint8Array(this.buffer, this.offset, bytes.length).set(bytes);
    this.offset += bytes.length;
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.offset);
  }
}

export class AXMLParser {
  private reader!: DataReader;
  private strings: string[] = [];
  private resourceIds: number[] = [];
  private elements: AXMLElement[] = [];
  private stringPoolOffset: number = 0;
  private stringPoolSize: number = 0;
  private resourceIdsOffset: number = 0;
  private resourceIdsSize: number = 0;
  private elementsOffset: number = 0;
  private isUtf8: boolean = false;

  parse(data: Uint8Array): ParsedAXML {
    this.reader = new DataReader(data);
    this.strings = [];
    this.resourceIds = [];
    this.elements = [];

    // Read file header
    const magic = this.reader.readUint32();
    if (magic !== CHUNK_AXML_FILE) {
      throw new Error(`Invalid AXML magic: 0x${magic.toString(16)}`);
    }

    const fileSize = this.reader.readUint32();

    // Parse chunks
    while (this.reader.position < fileSize) {
      const chunkStart = this.reader.position;
      const chunkType = this.reader.readUint32();
      const chunkSize = this.reader.readUint32();

      switch (chunkType) {
        case CHUNK_STRING_POOL:
          this.stringPoolOffset = chunkStart;
          this.stringPoolSize = chunkSize;
          this.parseStringPool(chunkSize);
          break;
        case CHUNK_RESOURCE_IDS:
          this.resourceIdsOffset = chunkStart;
          this.resourceIdsSize = chunkSize;
          this.parseResourceIds(chunkSize);
          break;
        case CHUNK_XML_START_NAMESPACE:
        case CHUNK_XML_END_NAMESPACE:
          if (this.elementsOffset === 0) this.elementsOffset = chunkStart;
          this.parseNamespace(chunkType);
          break;
        case CHUNK_XML_START_ELEMENT:
          if (this.elementsOffset === 0) this.elementsOffset = chunkStart;
          this.parseStartElement();
          break;
        case CHUNK_XML_END_ELEMENT:
          this.parseEndElement(chunkType);
          break;
        case CHUNK_XML_CDATA:
          this.parseCData();
          break;
        default:
          // Skip unknown chunks
          this.reader.position = chunkStart + chunkSize;
      }

      // Ensure we're at the end of the chunk
      if (this.reader.position < chunkStart + chunkSize) {
        this.reader.position = chunkStart + chunkSize;
      }
    }

    return {
      strings: this.strings,
      resourceIds: this.resourceIds,
      elements: this.elements,
      rawData: data,
      stringPoolOffset: this.stringPoolOffset,
      stringPoolSize: this.stringPoolSize,
      resourceIdsOffset: this.resourceIdsOffset,
      resourceIdsSize: this.resourceIdsSize,
      elementsOffset: this.elementsOffset,
    };
  }

  private parseStringPool(chunkSize: number): void {
    const stringCount = this.reader.readUint32();
    const styleCount = this.reader.readUint32();
    const flags = this.reader.readUint32();
    const stringsStart = this.reader.readUint32();
    const stylesStart = this.reader.readUint32();

    this.isUtf8 = (flags & (1 << 8)) !== 0;
    const isSorted = (flags & (1 << 0)) !== 0;

    // Read string offsets
    const stringOffsets: number[] = [];
    for (let i = 0; i < stringCount; i++) {
      stringOffsets.push(this.reader.readUint32());
    }

    // Skip style offsets
    for (let i = 0; i < styleCount; i++) {
      this.reader.readUint32();
    }

    // Read strings
    const stringsDataStart = this.stringPoolOffset + 8 + stringsStart;
    for (let i = 0; i < stringCount; i++) {
      const stringOffset = stringsDataStart + stringOffsets[i];
      this.reader.position = stringOffset;

      if (this.isUtf8) {
        // UTF-8 format
        const charLen = this.readUtf8Length();
        const byteLen = this.readUtf8Length();
        const bytes = this.reader.readBytes(byteLen);
        this.strings.push(new TextDecoder('utf-8').decode(bytes));
      } else {
        // UTF-16 format
        const charLen = this.readUtf16Length();
        const chars: number[] = [];
        for (let j = 0; j < charLen; j++) {
          chars.push(this.reader.readUint16());
        }
        this.strings.push(String.fromCharCode(...chars));
      }
    }
  }

  private readUtf8Length(): number {
    let len = this.reader.readUint8();
    if ((len & 0x80) !== 0) {
      len = ((len & 0x7F) << 8) | this.reader.readUint8();
    }
    return len;
  }

  private readUtf16Length(): number {
    let len = this.reader.readUint16();
    if ((len & 0x8000) !== 0) {
      len = ((len & 0x7FFF) << 16) | this.reader.readUint16();
    }
    return len;
  }

  private parseResourceIds(chunkSize: number): void {
    const count = (chunkSize - 8) / 4;
    for (let i = 0; i < count; i++) {
      this.resourceIds.push(this.reader.readUint32());
    }
  }

  private parseNamespace(chunkType: number): void {
    const lineNumber = this.reader.readUint32();
    const comment = this.reader.readUint32();
    const prefix = this.reader.readUint32();
    const uri = this.reader.readUint32();

    this.elements.push({
      chunkType,
      lineNumber,
      comment,
      namespaceUri: prefix,
      name: uri,
    });
  }

  private parseStartElement(): void {
    const lineNumber = this.reader.readUint32();
    const comment = this.reader.readUint32();
    const namespaceUri = this.reader.readInt32();
    const name = this.reader.readUint32();
    const attributeStart = this.reader.readUint16();
    const attributeSize = this.reader.readUint16();
    const attributeCount = this.reader.readUint16();
    const idIndex = this.reader.readUint16();
    const classIndex = this.reader.readUint16();
    const styleIndex = this.reader.readUint16();

    const attributes: AXMLAttribute[] = [];
    for (let i = 0; i < attributeCount; i++) {
      attributes.push({
        namespaceUri: this.reader.readInt32(),
        name: this.reader.readUint32(),
        valueString: this.reader.readInt32(),
        type: this.reader.readUint32() >> 24,
        data: this.reader.readInt32(),
      });
    }

    this.elements.push({
      chunkType: CHUNK_XML_START_ELEMENT,
      lineNumber,
      comment,
      namespaceUri,
      name,
      attributeStart,
      attributeSize,
      attributeCount,
      idIndex,
      classIndex,
      styleIndex,
      attributes,
    });
  }

  private parseEndElement(chunkType: number): void {
    const lineNumber = this.reader.readUint32();
    const comment = this.reader.readUint32();
    const namespaceUri = this.reader.readInt32();
    const name = this.reader.readUint32();

    this.elements.push({
      chunkType,
      lineNumber,
      comment,
      namespaceUri,
      name,
    });
  }

  private parseCData(): void {
    const lineNumber = this.reader.readUint32();
    const comment = this.reader.readUint32();
    const data = this.reader.readUint32();
    this.reader.skip(8); // typed value

    this.elements.push({
      chunkType: CHUNK_XML_CDATA,
      lineNumber,
      comment,
      namespaceUri: -1,
      name: data,
    });
  }

  getString(index: number): string {
    if (index >= 0 && index < this.strings.length) {
      return this.strings[index];
    }
    return '';
  }

  getResourceId(index: number): number {
    if (index >= 0 && index < this.resourceIds.length) {
      return this.resourceIds[index];
    }
    return 0;
  }
}

export class AXMLModifier {
  private parsed: ParsedAXML;
  private newStrings: string[] = [];

  constructor(parsed: ParsedAXML) {
    this.parsed = parsed;
    this.newStrings = [...parsed.strings];
  }

  getManifestInfo(): ApkManifestInfo {
    const info: ApkManifestInfo = {
      packageName: '',
      versionCode: 0,
      versionName: '',
      minSdkVersion: 0,
      targetSdkVersion: 0,
      isDebuggable: false,
      permissions: [],
      applicationName: '',
    };

    for (const element of this.parsed.elements) {
      if (element.chunkType === CHUNK_XML_START_ELEMENT) {
        const tagName = this.parsed.strings[element.name] || '';
        
        if (tagName === 'manifest' && element.attributes) {
          for (const attr of element.attributes) {
            const attrName = this.parsed.strings[attr.name] || '';
            if (attrName === 'package') {
              info.packageName = this.parsed.strings[attr.data] || attr.data.toString();
            } else if (attrName === 'versionCode') {
              info.versionCode = attr.data;
            } else if (attrName === 'versionName') {
              info.versionName = this.parsed.strings[attr.valueString] || attr.data.toString();
            }
          }
        }
        
        if (tagName === 'uses-sdk' && element.attributes) {
          for (const attr of element.attributes) {
            const attrName = this.parsed.strings[attr.name] || '';
            if (attrName === 'minSdkVersion') {
              info.minSdkVersion = attr.data;
            } else if (attrName === 'targetSdkVersion') {
              info.targetSdkVersion = attr.data;
            }
          }
        }
        
        if (tagName === 'application' && element.attributes) {
          for (const attr of element.attributes) {
            const attrName = this.parsed.strings[attr.name] || '';
            if (attrName === 'debuggable') {
              info.isDebuggable = attr.data !== 0;
            } else if (attrName === 'name') {
              info.applicationName = this.parsed.strings[attr.valueString] || '';
            }
          }
        }
        
        if (tagName === 'uses-permission' && element.attributes) {
          for (const attr of element.attributes) {
            const attrName = this.parsed.strings[attr.name] || '';
            if (attrName === 'name') {
              const permission = this.parsed.strings[attr.valueString] || '';
              if (permission) {
                info.permissions.push(permission.replace('android.permission.', ''));
              }
            }
          }
        }
      }
    }

    return info;
  }

  makeDebuggable(): Uint8Array {
    // Find the application element and modify/add debuggable attribute
    const data = new Uint8Array(this.parsed.rawData);
    const view = new DataView(data.buffer);
    
    let applicationElementOffset = -1;
    let currentOffset = this.parsed.elementsOffset;
    
    // Find the application element
    const reader = new DataReader(data);
    reader.position = this.parsed.elementsOffset;
    
    while (reader.position < data.length) {
      const chunkStart = reader.position;
      const chunkType = reader.readUint32();
      const chunkSize = reader.readUint32();
      
      if (chunkType === CHUNK_XML_START_ELEMENT) {
        reader.skip(8); // lineNumber, comment
        const nsUri = reader.readInt32();
        const nameIdx = reader.readUint32();
        const attrStart = reader.readUint16();
        const attrSize = reader.readUint16();
        const attrCount = reader.readUint16();
        const idIdx = reader.readUint16();
        const classIdx = reader.readUint16();
        const styleIdx = reader.readUint16();
        
        const tagName = this.parsed.strings[nameIdx] || '';
        
        if (tagName === 'application') {
          // Found application element
          // Check if debuggable attribute exists
          let hasDebuggable = false;
          let debuggableAttrOffset = -1;
          
          const attrsOffset = chunkStart + 8 + 8 + 4 + 4 + 2 + 2 + 2 + 2 + 2 + 2;
          
          for (let i = 0; i < attrCount; i++) {
            const attrOffset = attrsOffset + (i * 20);
            reader.position = attrOffset + 4; // Skip namespace
            const attrNameIdx = reader.readUint32();
            const attrName = this.parsed.strings[attrNameIdx] || '';
            
            if (attrName === 'debuggable') {
              hasDebuggable = true;
              debuggableAttrOffset = attrOffset;
              // Set the value to true (0xFFFFFFFF)
              view.setInt32(attrOffset + 16, -1, true); // data = 0xFFFFFFFF = true
              break;
            }
          }
          
          if (!hasDebuggable) {
            // Need to add the debuggable attribute
            // This is more complex - we need to:
            // 1. Add "debuggable" to string pool if not exists
            // 2. Add ATTR_DEBUGGABLE to resource IDs if not exists
            // 3. Expand the element chunk to add the attribute
            // 4. Update all offsets
            
            return this.addDebuggableAttribute(data, chunkStart, attrCount, attrsOffset);
          }
          
          break;
        }
      }
      
      reader.position = chunkStart + chunkSize;
      if (chunkSize === 0) break;
    }
    
    return data;
  }

  private addDebuggableAttribute(
    data: Uint8Array,
    applicationChunkStart: number,
    currentAttrCount: number,
    attrsOffset: number
  ): Uint8Array {
    // Find or add "debuggable" string
    let debuggableStrIdx = this.parsed.strings.indexOf('debuggable');
    
    // Find android namespace string index
    let androidNsIdx = -1;
    for (let i = 0; i < this.parsed.strings.length; i++) {
      if (this.parsed.strings[i] === ANDROID_NS) {
        androidNsIdx = i;
        break;
      }
    }
    
    // Find debuggable resource ID index
    let debuggableResIdx = this.parsed.resourceIds.indexOf(ATTR_DEBUGGABLE);
    
    if (debuggableStrIdx === -1 || debuggableResIdx === -1) {
      // We need to rebuild the file with new string pool and resource IDs
      // This is a complex operation, so we'll use a different approach:
      // We'll look for an existing boolean attribute and repurpose its structure
      
      // For now, let's find any boolean attribute and copy its structure
      // Or, find allowBackup attribute which is commonly present
      
      let templateAttrOffset = -1;
      const reader = new DataReader(data);
      reader.position = attrsOffset;
      
      for (let i = 0; i < currentAttrCount; i++) {
        const attrOffset = attrsOffset + (i * 20);
        reader.position = attrOffset + 12; // Go to type field (high byte of typeAndRes)
        const typeAndRes = reader.readUint32();
        const type = typeAndRes >> 24;
        
        if (type === TYPE_INT_BOOLEAN) {
          templateAttrOffset = attrOffset;
          break;
        }
      }
      
      if (templateAttrOffset !== -1) {
        // We found a boolean attribute to use as template
        // We need to add a new attribute entry
        
        // Calculate new size
        const newAttrSize = 20; // Each attribute is 20 bytes
        const insertPosition = attrsOffset + (currentAttrCount * 20);
        
        // Create new data array with space for new attribute
        const newData = new Uint8Array(data.length + newAttrSize);
        
        // Copy data before insert position
        newData.set(data.subarray(0, insertPosition), 0);
        
        // Create new attribute entry
        const newAttr = new ArrayBuffer(20);
        const attrView = new DataView(newAttr);
        
        // Use android namespace
        attrView.setInt32(0, androidNsIdx, true); // namespace URI
        
        // Find or estimate string index for "debuggable"
        if (debuggableStrIdx === -1) {
          // String doesn't exist, we need to modify the string pool
          // This is complex, so we'll use a workaround:
          // Find the "allowBackup" string index and resource ID structure
          return this.rebuildWithDebuggable(data);
        }
        
        attrView.setUint32(4, debuggableStrIdx, true); // name
        attrView.setInt32(8, -1, true); // valueString (none for boolean)
        attrView.setUint32(12, (TYPE_INT_BOOLEAN << 24) | 0x08, true); // type and size
        attrView.setInt32(16, -1, true); // data = 0xFFFFFFFF = true
        
        newData.set(new Uint8Array(newAttr), insertPosition);
        
        // Copy remaining data
        newData.set(data.subarray(insertPosition), insertPosition + newAttrSize);
        
        // Update chunk sizes and attribute count
        const newView = new DataView(newData.buffer);
        
        // Update file size
        newView.setUint32(4, newData.length, true);
        
        // Update element chunk size
        const oldChunkSize = new DataView(data.buffer).getUint32(applicationChunkStart + 4, true);
        newView.setUint32(applicationChunkStart + 4, oldChunkSize + newAttrSize, true);
        
        // Update attribute count
        const attrCountOffset = applicationChunkStart + 8 + 8 + 4 + 4 + 2 + 2;
        newView.setUint16(attrCountOffset, currentAttrCount + 1, true);
        
        return newData;
      }
    }
    
    // Fallback: rebuild the entire file
    return this.rebuildWithDebuggable(data);
  }

  private rebuildWithDebuggable(originalData: Uint8Array): Uint8Array {
    // Create a new AXML file with the debuggable attribute added
    const writer = new DataWriter(originalData.length + 1024);
    
    // Check if debuggable string exists, if not we need to add it
    let debuggableStrIdx = this.parsed.strings.indexOf('debuggable');
    const needNewString = debuggableStrIdx === -1;
    
    if (needNewString) {
      debuggableStrIdx = this.parsed.strings.length;
      this.newStrings = [...this.parsed.strings, 'debuggable'];
    } else {
      this.newStrings = [...this.parsed.strings];
    }
    
    // Check if resource ID exists
    let debuggableResIdx = this.parsed.resourceIds.indexOf(ATTR_DEBUGGABLE);
    const needNewResId = debuggableResIdx === -1;
    const newResourceIds = needNewResId 
      ? [...this.parsed.resourceIds, ATTR_DEBUGGABLE]
      : [...this.parsed.resourceIds];
    
    if (needNewResId) {
      debuggableResIdx = this.parsed.resourceIds.length;
    }
    
    // Write file header placeholder
    writer.writeUint32(CHUNK_AXML_FILE);
    writer.writeUint32(0); // File size placeholder
    
    // Write string pool
    this.writeStringPool(writer, this.newStrings);
    
    // Write resource IDs
    this.writeResourceIds(writer, newResourceIds);
    
    // Write elements with modifications
    this.writeElements(writer, debuggableStrIdx, needNewString);
    
    // Update file size
    const bytes = writer.getBytes();
    const finalView = new DataView(bytes.buffer);
    finalView.setUint32(4, bytes.length, true);
    
    return bytes;
  }

  private writeStringPool(writer: DataWriter, strings: string[]): void {
    const startPos = writer.position;
    
    // Chunk header
    writer.writeUint32(CHUNK_STRING_POOL);
    const chunkSizePos = writer.position;
    writer.writeUint32(0); // Size placeholder
    
    // String pool header
    writer.writeUint32(strings.length); // String count
    writer.writeUint32(0); // Style count
    writer.writeUint32(1 << 8); // Flags: UTF-8
    const stringsStartPos = writer.position;
    writer.writeUint32(0); // Strings start placeholder
    writer.writeUint32(0); // Styles start (none)
    
    // String offsets
    const offsetsStart = writer.position;
    for (let i = 0; i < strings.length; i++) {
      writer.writeUint32(0); // Placeholder
    }
    
    // Calculate strings start relative to chunk
    const stringsDataStart = writer.position;
    const stringsStart = stringsDataStart - startPos - 8;
    
    // Update strings start
    const bytes = writer.getBytes();
    const view = new DataView(bytes.buffer);
    view.setUint32(stringsStartPos, stringsStart, true);
    
    // Write strings and update offsets
    for (let i = 0; i < strings.length; i++) {
      const stringOffset = writer.position - stringsDataStart;
      view.setUint32(offsetsStart + (i * 4), stringOffset, true);
      
      const str = strings[i];
      const encoded = new TextEncoder().encode(str);
      
      // Write UTF-8 length (char count and byte count)
      if (encoded.length >= 0x80) {
        writer.writeUint8(((encoded.length >> 8) & 0x7F) | 0x80);
        writer.writeUint8(encoded.length & 0xFF);
      } else {
        writer.writeUint8(encoded.length);
      }
      
      if (encoded.length >= 0x80) {
        writer.writeUint8(((encoded.length >> 8) & 0x7F) | 0x80);
        writer.writeUint8(encoded.length & 0xFF);
      } else {
        writer.writeUint8(encoded.length);
      }
      
      writer.writeBytes(encoded);
      writer.writeUint8(0); // Null terminator
    }
    
    // Align to 4 bytes
    while (writer.position % 4 !== 0) {
      writer.writeUint8(0);
    }
    
    // Update chunk size
    const finalBytes = writer.getBytes();
    const finalView = new DataView(finalBytes.buffer);
    finalView.setUint32(chunkSizePos, writer.position - startPos, true);
  }

  private writeResourceIds(writer: DataWriter, resourceIds: number[]): void {
    const startPos = writer.position;
    
    writer.writeUint32(CHUNK_RESOURCE_IDS);
    writer.writeUint32(8 + (resourceIds.length * 4)); // Chunk size
    
    for (const id of resourceIds) {
      writer.writeUint32(id);
    }
  }

  private writeElements(writer: DataWriter, debuggableStrIdx: number, addedNewString: boolean): void {
    const reader = new DataReader(this.parsed.rawData);
    reader.position = this.parsed.elementsOffset;
    
    // Find android namespace index
    let androidNsIdx = -1;
    for (let i = 0; i < this.newStrings.length; i++) {
      if (this.newStrings[i] === ANDROID_NS) {
        androidNsIdx = i;
        break;
      }
    }
    
    while (reader.position < reader.length) {
      const chunkStart = reader.position;
      const chunkType = reader.readUint32();
      const chunkSize = reader.readUint32();
      
      if (chunkSize === 0 || chunkStart + chunkSize > reader.length) break;
      
      if (chunkType === CHUNK_XML_START_ELEMENT) {
        const lineNumber = reader.readUint32();
        const comment = reader.readUint32();
        const nsUri = reader.readInt32();
        const nameIdx = reader.readUint32();
        const attrStart = reader.readUint16();
        const attrSize = reader.readUint16();
        const attrCount = reader.readUint16();
        const idIdx = reader.readUint16();
        const classIdx = reader.readUint16();
        const styleIdx = reader.readUint16();
        
        const tagName = this.parsed.strings[nameIdx] || '';
        const isApplication = tagName === 'application';
        
        // Read existing attributes
        const attributes: AXMLAttribute[] = [];
        let hasDebuggable = false;
        
        for (let i = 0; i < attrCount; i++) {
          const attr: AXMLAttribute = {
            namespaceUri: reader.readInt32(),
            name: reader.readUint32(),
            valueString: reader.readInt32(),
            type: reader.readUint32() >> 24,
            data: reader.readInt32(),
          };
          
          const attrName = this.parsed.strings[attr.name] || '';
          if (attrName === 'debuggable') {
            hasDebuggable = true;
            attr.data = -1; // Set to true
          }
          
          attributes.push(attr);
        }
        
        // Add debuggable attribute if this is application and doesn't have it
        if (isApplication && !hasDebuggable) {
          attributes.push({
            namespaceUri: androidNsIdx,
            name: debuggableStrIdx,
            valueString: -1,
            type: TYPE_INT_BOOLEAN,
            data: -1, // true
          });
        }
        
        // Write the element
        const elemStartPos = writer.position;
        writer.writeUint32(CHUNK_XML_START_ELEMENT);
        const elemSizePos = writer.position;
        writer.writeUint32(0); // Size placeholder
        writer.writeUint32(lineNumber);
        writer.writeUint32(comment);
        writer.writeInt32(nsUri);
        writer.writeUint32(nameIdx);
        writer.writeUint16(0x14); // attributeStart
        writer.writeUint16(0x14); // attributeSize
        writer.writeUint16(attributes.length);
        writer.writeUint16(idIdx);
        writer.writeUint16(classIdx);
        writer.writeUint16(styleIdx);
        
        // Write attributes
        for (const attr of attributes) {
          writer.writeInt32(attr.namespaceUri);
          writer.writeUint32(attr.name);
          writer.writeInt32(attr.valueString);
          writer.writeUint32((attr.type << 24) | 0x08);
          writer.writeInt32(attr.data);
        }
        
        // Update chunk size
        const elemBytes = writer.getBytes();
        const elemView = new DataView(elemBytes.buffer);
        elemView.setUint32(elemSizePos, writer.position - elemStartPos, true);
        
      } else {
        // Copy other chunks as-is
        reader.position = chunkStart;
        const chunkData = reader.readBytes(chunkSize);
        writer.writeBytes(chunkData);
      }
    }
  }
}

export function parseAndroidManifest(data: Uint8Array): { info: ApkManifestInfo; parsed: ParsedAXML } {
  const parser = new AXMLParser();
  const parsed = parser.parse(data);
  const modifier = new AXMLModifier(parsed);
  const info = modifier.getManifestInfo();
  return { info, parsed };
}

export function makeManifestDebuggable(data: Uint8Array): Uint8Array {
  const parser = new AXMLParser();
  const parsed = parser.parse(data);
  const modifier = new AXMLModifier(parsed);
  return modifier.makeDebuggable();
}
