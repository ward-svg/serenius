export type EmailBuilderBlockType = 'header' | 'hero' | 'story' | 'highlight' | 'cta' | 'image' | 'divider';

export interface HeaderBlock {
  id: string;
  type: 'header';
  logoUrl: string;
  logoWidth: number;
  tagline: string;
  alignment: 'left' | 'center' | 'right';
  backgroundColor: string;
  taglineOffset?: number;
  taglineColor?: string;
  taglineSize?: number;
  taglineFontRole?: 'heading' | 'body';
}

export interface HeroBlock {
  id: string;
  type: 'hero';
  eyebrow: string;
  headline: string;
  subtitle: string;
  backgroundColor: string;
  textColor: string;
  alignment: 'left' | 'center' | 'right';
  paddingY?: number;
  headlineSize?: number;
  subtitleSize?: number;
  eyebrowColor?: string;
  eyebrowSize?: number;
  eyebrowUppercase?: boolean;
  eyebrowFontRole?: 'heading' | 'body';
  headlineColor?: string;
  headlineFontRole?: 'heading' | 'body';
  subtitleColor?: string;
  subtitleFontRole?: 'heading' | 'body';
}

export interface StoryBlock {
  id: string;
  type: 'story';
  content: string;
  backgroundColor?: string;
  textColor?: string;
  textSize?: number;
  fontRole?: 'heading' | 'body';
  alignment?: 'left' | 'center' | 'right';
  paddingY?: number;
}

export interface HighlightBlock {
  id: string;
  type: 'highlight';
  variant: 'quote' | 'callout' | 'list';
  heading: string;
  body: string;
  items: string[];
  backgroundColor?: string;
  accentColor?: string;
  textColor?: string;
  headingSize?: number;
  bodySize?: number;
  headingFontRole?: 'heading' | 'body';
  bodyFontRole?: 'heading' | 'body';
  alignment?: 'left' | 'center' | 'right';
  paddingY?: number;
}

export interface CtaBlock {
  id: string;
  type: 'cta';
  variant: 'button' | 'panel' | 'offer';
  heading: string;
  body: string;
  buttonText: string;
  buttonUrl: string;
  amount: string;
  items: string[];
  backgroundColor?: string;
  accentColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  headingSize?: number;
  bodySize?: number;
  buttonTextSize?: number;
  headingFontRole?: 'heading' | 'body';
  bodyFontRole?: 'heading' | 'body';
  alignment?: 'left' | 'center' | 'right';
  paddingY?: number;
}

export interface ImageSlot {
  assetId?: string;
  url: string;
  altText?: string;
}

export interface ImageBlock {
  id: string;
  type: 'image';
  layout: 'one' | 'two' | 'three';
  images: ImageSlot[];
  singleImageSize?: 'small' | 'medium' | 'large' | 'full';
  borderStyle?: 'none' | 'thin' | 'medium';
  borderColor?: string;
  roundedCorners?: 'none' | 'small' | 'medium' | 'large';
  paddingY?: number;
  paddingX?: number;
  backgroundColor?: string;
}

export interface DividerBlock {
  id: string;
  type: 'divider';
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  lineColor?: string;
  backgroundColor?: string;
  lineWidth?: 'third' | 'half' | 'full';
  alignment?: 'left' | 'center' | 'right';
  thickness?: number;
  paddingY?: number;
}

export type EmailBuilderBlock = HeaderBlock | HeroBlock | StoryBlock | HighlightBlock | CtaBlock | ImageBlock | DividerBlock;

export interface EmailBuilderDesign {
  version: 1;
  blocks: EmailBuilderBlock[];
}
