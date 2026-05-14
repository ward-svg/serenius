export type EmailBuilderBlockType = 'header' | 'hero' | 'story' | 'highlight' | 'cta';

export interface HeaderBlock {
  id: string;
  type: 'header';
  logoUrl: string;
  logoWidth: number;
  tagline: string;
  alignment: 'left' | 'center' | 'right';
  backgroundColor: string;
  taglineOffset?: number;
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
}

export interface StoryBlock {
  id: string;
  type: 'story';
  content: string;
}

export interface HighlightBlock {
  id: string;
  type: 'highlight';
  variant: 'quote' | 'callout' | 'list';
  heading: string;
  body: string;
  items: string[];
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
}

export type EmailBuilderBlock = HeaderBlock | HeroBlock | StoryBlock | HighlightBlock | CtaBlock;

export interface EmailBuilderDesign {
  version: 1;
  blocks: EmailBuilderBlock[];
}
