import { UnicodeTest } from './UnicodeTest';

export default {
  title: 'Feedback/UnicodeTest',
  component: UnicodeTest,
  tags: ['autodocs'],
  argTypes: {
    maxLength: { control: { type: 'range', min: 1, max: 20, step: 1 } },
  },
};

export const EmojisSimples = {
  args: {
    text: 'Hello 👋 world 🌍!',
    maxLength: 6,
  },
};

export const ZWJSequence = {
  args: {
    // Family: Man, Woman, Girl, Boy (using Zero Width Joiner)
    // Classic will truncate and show separate pieces or broken symbols.
    text: 'Family: 👨‍👩‍👧‍👦 finished',
    maxLength: 10,
  },
};

export const Banderas = {
  args: {
    // Flags are composed of 2 regional characters
    text: 'Flags: 🇨🇱🇲🇽🇪🇸🇦🇷',
    maxLength: 12,
  },
};

export const TextoInternacional = {
  args: {
    text: 'こんにちは世界 (Japanese) / مرحبا بالعالم (Arabic)',
    maxLength: 8,
  },
};
