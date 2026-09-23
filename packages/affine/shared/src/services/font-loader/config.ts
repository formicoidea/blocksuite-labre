import { FontFamily, FontStyle, FontWeight } from '@labre/affine-model';
import { z } from 'zod';

export const fontConfigSchema = z.object({
  font: z.string(),
  weight: z.string(),
  url: z.string(),
  style: z.string(),
});

export type FontConfig = z.infer<typeof fontConfigSchema>;

/**
 * The AFFiNE-hosted mirror. It carries strictly fewer files than the community
 * list: `cdn.affine.pro` answers 404 for every `Inter-Bold`, `Poppins-Bold`
 * and `BebasNeue-Bold` spelling, so those three families offer no 700 weight
 * here. The Kalam / Lora `SemiBold` entries below already point at the 700
 * file — those families ship a single heavy face, not two.
 *
 * Satoshi is in neither list since #396: its licence (ITF Free Font License
 * 2.0, section 02) forbids offering it as a selectable font in a SaaS or design
 * tool, whoever hosts the files. `FontFamily.Satoshi` stays a valid stored
 * value; an element that carries it paints with the fallback, and the family
 * picker names it as unavailable instead of offering it.
 */
export const AffineCanvasTextFonts: FontConfig[] = [
  // Inter, https://fonts.cdnfonts.com/css/inter?styles=29139,29134,29135,29136,29140,29141
  {
    font: FontFamily.Inter,
    url: 'https://cdn.affine.pro/fonts/Inter-Light-BETA.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Inter,
    url: 'https://cdn.affine.pro/fonts/Inter-Regular.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Inter,
    url: 'https://cdn.affine.pro/fonts/Inter-SemiBold.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Inter,
    url: 'https://cdn.affine.pro/fonts/Inter-LightItalic-BETA.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Inter,
    url: 'https://cdn.affine.pro/fonts/Inter-Italic.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Inter,
    url: 'https://cdn.affine.pro/fonts/Inter-SemiBoldItalic.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  // Kalam, https://fonts.cdnfonts.com/css/kalam?styles=15166,170689,170687
  {
    font: FontFamily.Kalam,
    url: 'https://cdn.affine.pro/fonts/Kalam-Light.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Kalam,
    url: 'https://cdn.affine.pro/fonts/Kalam-Regular.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Kalam,
    url: 'https://cdn.affine.pro/fonts/Kalam-Bold.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  // Poppins, https://fonts.cdnfonts.com/css/poppins?styles=20394,20389,20390,20391,20395,20396
  {
    font: FontFamily.Poppins,
    url: 'https://cdn.affine.pro/fonts/Poppins-Light.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://cdn.affine.pro/fonts/Poppins-Regular.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://cdn.affine.pro/fonts/Poppins-Medium.woff2',
    weight: FontWeight.Medium,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://cdn.affine.pro/fonts/Poppins-SemiBold.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://cdn.affine.pro/fonts/Poppins-LightItalic.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://cdn.affine.pro/fonts/Poppins-Italic.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://cdn.affine.pro/fonts/Poppins-SemiBoldItalic.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  // Lora, https://fonts.cdnfonts.com/css/lora-4?styles=50357,50356,50354,50355
  {
    font: FontFamily.Lora,
    url: 'https://cdn.affine.pro/fonts/Lora-Regular.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Lora,
    url: 'https://cdn.affine.pro/fonts/Lora-Bold.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Lora,
    url: 'https://cdn.affine.pro/fonts/Lora-Italic.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Lora,
    url: 'https://cdn.affine.pro/fonts/Lora-BoldItalic.woff2',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  // BebasNeue, https://fonts.cdnfonts.com/css/bebas-neue?styles=169713,17622,17620
  {
    font: FontFamily.BebasNeue,
    url: 'https://cdn.affine.pro/fonts/BebasNeue-Light.woff2',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.BebasNeue,
    url: 'https://cdn.affine.pro/fonts/BebasNeue-Regular.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  // OrelegaOne, https://fonts.cdnfonts.com/css/orelega-one?styles=148618
  {
    font: FontFamily.OrelegaOne,
    url: 'https://cdn.affine.pro/fonts/OrelegaOne-Regular.woff2',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
];

/**
 * The families on a public mirror, one `FontConfig` per face. A host that
 * promises no third-party request passes the same list with its own `url`s;
 * a host that drops a family drops it from the family picker too (#396).
 */
export const CommunityCanvasTextFonts: FontConfig[] = [
  // Inter, https://fonts.cdnfonts.com/css/inter?styles=29139,29134,29135,29136,29140,29141
  {
    font: FontFamily.Inter,
    url: 'https://fonts.cdnfonts.com/s/19795/Inter-Light-BETA.woff',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Inter,
    url: 'https://fonts.cdnfonts.com/s/19795/Inter-Regular.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Inter,
    url: 'https://fonts.cdnfonts.com/s/19795/Inter-SemiBold.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Inter,
    url: 'https://fonts.cdnfonts.com/s/19795/Inter-LightItalic-BETA.woff',
    weight: FontWeight.Light,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Inter,
    url: 'https://fonts.cdnfonts.com/s/19795/Inter-Italic.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Inter,
    url: 'https://fonts.cdnfonts.com/s/19795/Inter-Bold.woff',
    weight: FontWeight.Bold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Inter,
    url: 'https://fonts.cdnfonts.com/s/19795/Inter-SemiBoldItalic.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Inter,
    url: 'https://fonts.cdnfonts.com/s/19795/Inter-BoldItalic.woff',
    weight: FontWeight.Bold,
    style: FontStyle.Italic,
  },
  // Kalam, https://fonts.cdnfonts.com/css/kalam?styles=15166,170689,170687
  // Kalam ships no 600 face: its `SemiBold` entry below already IS the 700
  // file, so the family offers one heavy weight, not two.
  {
    font: FontFamily.Kalam,
    url: 'https://fonts.cdnfonts.com/s/13130/Kalam-Light.woff',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Kalam,
    url: 'https://fonts.cdnfonts.com/s/13130/Kalam-Regular.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Kalam,
    url: 'https://fonts.cdnfonts.com/s/13130/Kalam-Bold.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  // PlusJakartaSans (SIL OFL 1.1), https://fonts.cdnfonts.com/css/plus-jakarta-sans
  // The mirror serves the two variable files only (weights 200 to 800), so
  // every face below points at one of them: a face declared with a single
  // weight gets that weight from the file's `wght` axis.
  {
    font: FontFamily.PlusJakartaSans,
    url: 'https://fonts.cdnfonts.com/s/107199/PlusJakartaSans%5Bwght%5D.woff',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.PlusJakartaSans,
    url: 'https://fonts.cdnfonts.com/s/107199/PlusJakartaSans%5Bwght%5D.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.PlusJakartaSans,
    url: 'https://fonts.cdnfonts.com/s/107199/PlusJakartaSans%5Bwght%5D.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.PlusJakartaSans,
    url: 'https://fonts.cdnfonts.com/s/107199/PlusJakartaSans%5Bwght%5D.woff',
    weight: FontWeight.Bold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.PlusJakartaSans,
    url: 'https://fonts.cdnfonts.com/s/107199/PlusJakartaSans-Italic%5Bwght%5D.woff',
    weight: FontWeight.Light,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.PlusJakartaSans,
    url: 'https://fonts.cdnfonts.com/s/107199/PlusJakartaSans-Italic%5Bwght%5D.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.PlusJakartaSans,
    url: 'https://fonts.cdnfonts.com/s/107199/PlusJakartaSans-Italic%5Bwght%5D.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.PlusJakartaSans,
    url: 'https://fonts.cdnfonts.com/s/107199/PlusJakartaSans-Italic%5Bwght%5D.woff',
    weight: FontWeight.Bold,
    style: FontStyle.Italic,
  },
  // Poppins, https://fonts.cdnfonts.com/css/poppins?styles=20394,20389,20390,20391,20395,20396
  {
    font: FontFamily.Poppins,
    url: 'https://fonts.cdnfonts.com/s/16009/Poppins-Light.woff',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://fonts.cdnfonts.com/s/16009/Poppins-Regular.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://fonts.cdnfonts.com/s/16009/Poppins-Medium.woff',
    weight: FontWeight.Medium,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://fonts.cdnfonts.com/s/16009/Poppins-SemiBold.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://fonts.cdnfonts.com/s/16009/Poppins-Bold.woff',
    weight: FontWeight.Bold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://fonts.cdnfonts.com/s/16009/Poppins-LightItalic.woff',
    weight: FontWeight.Light,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://fonts.cdnfonts.com/s/16009/Poppins-Italic.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://fonts.cdnfonts.com/s/16009/Poppins-SemiBoldItalic.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Poppins,
    url: 'https://fonts.cdnfonts.com/s/16009/Poppins-BoldItalic.woff',
    weight: FontWeight.Bold,
    style: FontStyle.Italic,
  },
  // Lora, https://fonts.cdnfonts.com/css/lora-4?styles=50357,50356,50354,50355
  // Lora ships no 600 face either: as with Kalam, the entries below map the
  // 700 file onto `SemiBold` and the family has a single heavy.
  {
    font: FontFamily.Lora,
    url: 'https://fonts.cdnfonts.com/s/29883/Lora-Regular.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Lora,
    url: 'https://fonts.cdnfonts.com/s/29883/Lora-Bold.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.Lora,
    url: 'https://fonts.cdnfonts.com/s/29883/Lora-Italic.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Italic,
  },
  {
    font: FontFamily.Lora,
    url: 'https://fonts.cdnfonts.com/s/29883/Lora-BoldItalic.woff',
    weight: FontWeight.SemiBold,
    style: FontStyle.Italic,
  },
  // BebasNeue, https://fonts.cdnfonts.com/css/bebas-neue?styles=169713,17622,17620
  {
    font: FontFamily.BebasNeue,
    url: 'https://fonts.cdnfonts.com/s/14902/BebasNeue%20Light.woff',
    weight: FontWeight.Light,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.BebasNeue,
    url: 'https://fonts.cdnfonts.com/s/14902/BebasNeue-Regular.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
  {
    font: FontFamily.BebasNeue,
    // The bold face is the one Bebas Neue file whose name is spelled with a
    // space, like the light one above and unlike the regular one.
    url: 'https://fonts.cdnfonts.com/s/14902/BebasNeue%20Bold.woff',
    weight: FontWeight.Bold,
    style: FontStyle.Normal,
  },
  // OrelegaOne, https://fonts.cdnfonts.com/css/orelega-one?styles=148618
  {
    font: FontFamily.OrelegaOne,
    url: 'https://fonts.cdnfonts.com/s/93179/OrelegaOne-Regular.woff',
    weight: FontWeight.Regular,
    style: FontStyle.Normal,
  },
];
