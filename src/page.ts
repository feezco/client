export interface FeezcoPage {
  elements: Elements;
}

export interface Elements {
  text1: Text1;
  img1: Img1;
  modalText1: Img1;
}

export interface Img1 {
  tag: string;
  data: string;
  attributes: Img1_Attributes;
}

export interface Img1_Attributes {
  alt: string;
  style: PurpleStyle;
}

export interface PurpleStyle {
  string: String;
  object: PurpleObject;
}

export interface PurpleObject {
  regular: RegularClass;
  important: RegularClass;
}

export interface RegularClass {
  width: string;
}

export interface String {
  regular: string;
  important: string;
}

export interface Text1 {
  tag: string;
  data: string;
  attributes: Text1_Attributes;
}

export interface Text1_Attributes {
  style: FluffyStyle;
  href: string;
}

export interface FluffyStyle {
  string: String;
  object: FluffyObject;
}

export interface FluffyObject {
  regular: Regular;
  important: PurpleImportant;
}

export interface PurpleImportant {
  color: string;
}

export interface Regular {
  color: string;
  href: string;
}

export function sumFeezco(a: number, b: number) {
  return a + b
}

export function multiplyFeezco(a: number, b: number) {
  return a * b
}