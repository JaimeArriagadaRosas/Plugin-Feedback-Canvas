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
    text: 'Hola 👋 mundo 🌍!',
    maxLength: 6,
  },
};

export const ZWJSequence = {
  args: {
    // Familia: Hombre, Mujer, Niña, Niño (usando Zero Width Joiner)
    // Clásico truncará y mostrará piezas separadas o símbolos rotos.
    text: 'Familia: 👨‍👩‍👧‍👦 terminada',
    maxLength: 10,
  },
};

export const Banderas = {
  args: {
    // Las banderas se componen de 2 caracteres regionales
    text: 'Banderas: 🇨🇱🇲🇽🇪🇸🇦🇷',
    maxLength: 12,
  },
};

export const TextoInternacional = {
  args: {
    text: 'こんにちは世界 (Japonés) / مرحبا بالعالم (Árabe)',
    maxLength: 8,
  },
};
