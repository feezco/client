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

  let conditionalPageContentTypes = `type PageContent<T> =`;

  let enumJsFileContent = readFileSync(`${__dirname}/enum.js`, "utf-8");

  const contentToReplace = 'FeezcoPagePath["Home"] = "/home";';

  let pagesEnum = `export enum FeezcoPagePath {`;

  let pageEnumDefinition = ``;

  writeFileSync(`${__dirname}/page.d.ts`, "");

  for (const path in pages) {
    const pageAlias = toPascalCase(path);

    const getPageRes = await axios.get(
      `https://cdn.feezco.com/page?path=${pages[path]}&key=${key}&stage=${process.env.FEEZCO_STAGE}`
    );

    if (!getPageRes.data) {
      continue;
    }

    const { lines } = await quicktypeJSON(
      "typescript",
      `FeezcoPage${pageAlias}`,
      JSON.stringify(getPageRes.data)
    );

    conditionalPageContentTypes = `${conditionalPageContentTypes}
  T extends FeezcoPagePath.${pageAlias} ? FeezcoPage${pageAlias}
  :
`;

    pagesEnum = `${pagesEnum}
  ${pageAlias} = '${pages[path]}',
`;

    pageEnumDefinition = `${pageEnumDefinition}
FeezcoPagePath["${pageAlias}"] = "${pages[path]}";
`;

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

    const existingPageTsFile = readFileSync(`${__dirname}/basePage.d.ts`, "utf-8")
      .split(
        `
// To parse this data:`
      )[0]
      .replace(`import { FeezcoPagePath } from './enum'\n`, "");

    const existingInterfacesPageTsFile = readFileSync(
      `${__dirname}/page.d.ts`,
      "utf-8"
    ).split(
      `
// match the expected interface, even if the JSON is valid.
`
    )[1];

    writeFileSync(
      `${__dirname}/page.d.ts`,
      `${existingPageTsFile}
${existingInterfacesPageTsFile ? existingInterfacesPageTsFile : ""}
${replacedPageInterfaces}
    `
    );
  }

  enumJsFileContent = enumJsFileContent.replace(
    contentToReplace,
    pageEnumDefinition
  );

  pagesEnum = `${pagesEnum.substring(0, pagesEnum.length - 1)}
}`;

  conditionalPageContentTypes = `${conditionalPageContentTypes} never`;

  let pageDTsFileContent = readFileSync(`${__dirname}/page.d.ts`, "utf-8");

  pageDTsFileContent = pageDTsFileContent.replace(
    "type PageContent<T> = T extends T ? T : T;",
    conditionalPageContentTypes
  );

  pageDTsFileContent = `import { FeezcoPagePath } from './enum'
${pageDTsFileContent}  
`;

  writeFileSync(`${__dirname}/page.d.ts`, pageDTsFileContent);
  writeFileSync(`${__dirname}/enum.d.ts`, pagesEnum);
  writeFileSync(`${__dirname}/enum.js`, enumJsFileContent);
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
