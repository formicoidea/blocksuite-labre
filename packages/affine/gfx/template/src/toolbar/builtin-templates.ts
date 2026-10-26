import { otherTemplateCategory } from '../builtin/other.js';
import { slidesTemplateCategory } from '../builtin/slides/index.js';
import type {
  Template,
  TemplateCategory,
  TemplateManager,
} from './template-type.js';

export const templates: TemplateCategory[] = [
  otherTemplateCategory,
  slidesTemplateCategory,
];

function lcs(text1: string, text2: string) {
  const dp: number[][] = Array.from(
    {
      length: text1.length + 1,
    },
    () => Array.from({ length: text2.length + 1 }, () => 0)
  );

  for (let i = 1; i <= text1.length; i++) {
    for (let j = 1; j <= text2.length; j++) {
      if (text1[i - 1] === text2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[text1.length][text2.length];
}
/**
 * The catalogue every editor has, whatever is mounted: `Other` and `Slides`. A host or a
 * framework adds a category per editor with `TemplateCategoryExtension`; the
 * module-level `extend(...)` this object carried until 0.49 appended for every
 * editor of the page and was never emptied.
 */
export const builtInTemplates = {
  list: async (category: string): Promise<Template[]> => {
    const cate = templates.find(cate => cate.name === category);
    if (!cate) return [];
    return cate.templates instanceof Function
      ? cate.templates()
      : cate.templates;
  },

  categories: async (): Promise<string[]> => templates.map(cate => cate.name),

  categoryLabel: (name: string): string | undefined =>
    templates.find(cate => cate.name === name)?.nameKey,

  search: async (keyword: string, cateName?: string): Promise<Template[]> => {
    const candidates: Template[] = [];
    keyword = keyword.trim().toLocaleLowerCase();

    await Promise.all(
      templates.map(async categroy => {
        if (cateName && cateName !== categroy.name) {
          return;
        }

        if (categroy.templates instanceof Function) {
          return categroy.templates();
        }

        return Promise.all(
          Object.entries(categroy.templates).map(async ([name, template]) => {
            if (
              lcs(keyword, (name as string).toLocaleLowerCase()) ===
              keyword.length
            ) {
              candidates.push(template);
            }
          })
        );
      })
    );

    return candidates;
  },
} satisfies TemplateManager;
