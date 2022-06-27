import axios from "axios";
import dotenv from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "fs";

dotenv.config();

type PageContent<T> = T extends T ? T : T;

const feezcoConfig = existsSync(`${process.cwd()}/feezco.config.json`)
  ? readFileSync(`${process.cwd()}/feezco.config.json`, "utf-8")
  : null;

if (!feezcoConfig) {
  throw new Error(
    "Cannot find feezco config file. Please make sure feezco.config.json is set up in your project root."
  );
}

const feezcoPlaceholders = existsSync(
  `${process.cwd()}/feezco.placeholders.json`
)
  ? readFileSync(`${process.cwd()}/feezco.placeholders.json`, "utf-8")
  : null;

const feezcoConfigParsed: {
  pages: Record<string, { id: string; path: string }>;
  key: string;
} = JSON.parse(feezcoConfig);

const feezcoPlaceholdersParsed: Record<string, string> = feezcoPlaceholders
  ? JSON.parse(feezcoPlaceholders)
  : null;

const populateMissingElements = ({
  pagePath,
  data,
}: {
  pagePath: string;
  data: Record<string, unknown>;
}) => {
  const key = Object.keys(feezcoConfigParsed.pages).find(
    (k) => feezcoConfigParsed.pages[k].path === pagePath
  );

  if (key && feezcoPlaceholdersParsed[key]) {
    const missingElementsKeys = Object.keys(feezcoPlaceholdersParsed[key]);

    for (const elementKey of missingElementsKeys) {
      // @ts-expect-error
      if (!data.elements[elementKey]) {
        // @ts-expect-error
        data.elements[elementKey] =
          feezcoPlaceholdersParsed[key][elementKey as unknown as number];
      }
    }
  }

  return data;
};

export const getServerSidePageContent = async <T>({
  path,
}: {
  path: string;
}): Promise<PageContent<T> | void> => {
  const cachedContentDataRes =
    existsSync(`${__dirname}/cachedContentData.json`) &&
    process.env.FEEZCO_STAGE !== "PRODUCTION"
      ? JSON.parse(readFileSync(`${__dirname}/cachedContentData.json`, "utf-8"))
      : null;

  const feezcoConfigObj = existsSync(`${process.cwd()}/feezco.config.json`)
    ? JSON.parse(readFileSync(`${process.cwd()}/feezco.config.json`, "utf-8"))
    : null;

  const resData =
    cachedContentDataRes ||
    ((
      await axios.get(
        `https://cdn.feezco.com/page?path=${path}&key=${feezcoConfigObj.key}&stage=${process.env.FEEZCO_STAGE}`
      )
    ).data as PageContent<T>);

  if (!cachedContentDataRes && resData) {
    writeFileSync(
      `${__dirname}/cachedContentData.json`,
      JSON.stringify(resData)
    );
  }

  // @ts-expect-error type error
  return populateMissingElements({ pagePath: path, data: resData });
};