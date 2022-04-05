#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
import axios from "axios";
import dotenv from "dotenv";
import {
  quicktype,
  InputData,
  jsonInputForTargetLanguage,
} from "quicktype-core";
import { toPascalCase } from "./helpers";

dotenv.config();

const feezconConfig = readFileSync(
  `${process.cwd()}/feezco.config.json`,
  "utf-8"
);

const feezcoConfigParsed: { pages: Record<string, string>; key: string } =
  JSON.parse(feezconConfig);

const generateTypes = async () => {
  const { pages, key } = feezcoConfigParsed;

  let pagesEnum = `export enum FeezcoPagePath {`;

  for (const path in pages) {
    const pageAlias = toPascalCase(path);

    pagesEnum = `${pagesEnum}
  ${pageAlias} = '${pages[path]}',
`;
    const getPageRes = await axios.get(
      `https://cdn.feezco.com/page?path=${pages[path]}&key=${key}&stage=${process.env.FEEZCO_STAGE}`
    );

    const { lines } = await quicktypeJSON(
      "typescript",
      `FeezcoPage${pageAlias}`,
      JSON.stringify(getPageRes.data)
    );

    const pageInterfaces = lines
      .join("\n")
      .split("// Converts JSON strings to/from your types")[0];

    const interfaceNames = pageInterfaces
      .match(new RegExp("(?<=:)(.*?)(?=;)", "g"))
      ?.map((eachInterface) => {
        return eachInterface.trim();
      })
      .filter((eachInterface) => {
        return !["string", "boolean", "number", "void"].includes(eachInterface);
      });

    const interfaceNamesPrefixed = interfaceNames?.map((eachInterface) => {
      return `${pageAlias}${eachInterface}`;
    });

    let replacedPageInterfaces = pageInterfaces;

    const replacedStr: string[] = [];

    interfaceNames?.forEach((eachName, i) => {
      if (interfaceNamesPrefixed?.[i]) {
        if (!replacedStr.includes(eachName)) {
          replacedPageInterfaces = replacedPageInterfaces.replace(
            new RegExp(eachName, "g"),
            interfaceNamesPrefixed?.[i]
          );
          replacedStr.push(eachName);
        }
      }
    });

    const existingPageTsFile = readFileSync(`${__dirname}/page.d.ts`, "utf-8");

    writeFileSync(
      `${__dirname}/page.d.ts`,
      `${existingPageTsFile}
${replacedPageInterfaces}
    `
    );
  }

  pagesEnum = `${pagesEnum.substring(0, pagesEnum.length - 1)}
}`;

  const existingPageTsFile = readFileSync(`${__dirname}/page.d.ts`, "utf-8");

  writeFileSync(
    `${__dirname}/page.d.ts`,
    `${existingPageTsFile}
${pagesEnum}
    `
  );
};

async function quicktypeJSON(
  targetLanguage: string,
  typeName: string,
  jsonString: string
) {
  const jsonInput = jsonInputForTargetLanguage(targetLanguage);

  await jsonInput.addSource({
    name: typeName,
    samples: [jsonString],
  });

  const inputData = new InputData();
  inputData.addInput(jsonInput);

  return await quicktype({
    inputData,
    lang: targetLanguage,
  });
}

generateTypes();
