import axios from "axios";
import dotenv from "dotenv";
import { readFileSync } from "fs";

dotenv.config();
export interface FeezcoPage {
  elements: Record<string, unknown>;
}

type PageContent<T> = T extends T ? T : T;

const feezconConfig = readFileSync(
  `${process.cwd()}/feezco.config.json`,
  "utf-8"
);

const feezcoPlaceholders = readFileSync(
  `${process.cwd()}/feezco.placeholders.json`,
  "utf-8"
);


const feezcoConfigParsed: { pages: Record<string, string>; key: string } =
  JSON.parse(feezconConfig);

const feezcoPlaceholdersParsed: { pages: Record<string, string>; key: string } =
  JSON.parse(feezcoPlaceholders);

const populateMissingElements = ({
  pagePath,
  data,
}: {
  pagePath: string;
  data: Record<string, unknown>;
}) => {
  const key = Object.keys(feezcoConfigParsed.pages).find(
    (k) => feezcoConfigParsed.pages[k] === pagePath
  );

  if (key) {
    // @ts-expect-error type error
    const missingElementsKeys = Object.keys(feezcoPlaceholdersParsed[key]);

    for (const elementKey of missingElementsKeys) {
      // @ts-expect-error type error
      data.elements[elementKey] = feezcoPlaceholdersParsed[key][elementKey];
    }
  }

  return data;
};

export const getPageContent = async <T>({
  path,
  key,
}: {
  path: T;
  key: string;
}): Promise<PageContent<T>> => {
  const res = (await axios.get(
    `https://cdn.feezco.com/page?path=${path}&key=${key}&stage=${process.env.FEEZCO_STAGE}`
  )) as { data: PageContent<T> };

  // @ts-expect-error type error
  return populateMissingElements({ pagePath: path, data: res.data });
};
