#!/usr/bin/env node
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import axios from "axios";
import dotenv from "dotenv";
import {
  quicktype,
  InputData,
  jsonInputForTargetLanguage,
} from "quicktype-core";
import { styleObjectToString, toPascalCase } from "./helpers";
import inquirer from "inquirer";
import clc from "cli-color";

dotenv.config();

const args = process.argv.slice(2);

const feezcoConfig = readFileSync(
  `${process.cwd()}/feezco.config.json`,
  "utf-8"
);

const feezcoConfigParsed: {
  pages: Record<string, { id: string; path: string }>;
  key: string;
} = JSON.parse(feezcoConfig);

const { pages, key } = feezcoConfigParsed;

const feezcoElementsFromJSON = existsSync(
  `${process.cwd()}/feezco.placeholders.json`
)
  ? readFileSync(`${process.cwd()}/feezco.placeholders.json`, "utf-8")
  : "{}";

const feezcoElementsFromJSONParsed: Record<string, unknown> = JSON.parse(
  feezcoElementsFromJSON
);

const feezcoGenerate = async (props?: {
  page: string;
  contentFromCLI: Record<string, unknown>;
}) => {
  const generateTypes = async () => {
    let conditionalPageContentTypes = `type PageContent<T> =`;

    let enumJsFileContent = readFileSync(`${__dirname}/enum.js`, "utf-8");

    let contentToReplace = 'FeezcoPagePath["Home"] = "/home";';

    let pagesEnum = `export enum FeezcoPagePath {`;

    let pageEnumDefinition = ``;

    writeFileSync(`${__dirname}/page.d.ts`, "");

    let enumContentToReplace = "";

    for (const page in pages) {
      const pageAlias = toPascalCase(page);

      if (
        enumJsFileContent.indexOf(
          `${
            !enumContentToReplace
              ? ""
              : `

`
          }FeezcoPagePath["${pageAlias}"] = "${pages[page].path}";`
        ) > -1
      ) {
        enumContentToReplace += `${
          !enumContentToReplace
            ? ""
            : `

`
        }FeezcoPagePath["${pageAlias}"] = "${pages[page].path}";`;
      }

      const getPageRes = await axios.get(
        `https://cdn.feezco.com/page?path=${pages[page].path}&key=${key}&stage=${process.env.FEEZCO_STAGE}`
      );

      if (!getPageRes.data) {
        continue;
      }

      let appendedElements = {
        ...getPageRes.data.elements,
        // @ts-ignore
        ...(feezcoElementsFromJSONParsed[page]
          ? feezcoElementsFromJSONParsed[page]
          : {}),
      };

      if (props?.contentFromCLI && props?.page === page) {
        // @ts-ignore
        appendedElements = { ...appendedElements, ...props.contentFromCLI };

        getPageRes.data.elements = appendedElements;

        // @ts-ignore
        feezcoElementsFromJSONParsed[props.page] = feezcoElementsFromJSONParsed[
          props.page
        ]
          ? {
              // @ts-ignore
              ...feezcoElementsFromJSONParsed[props.page],
              ...props.contentFromCLI,
            }
          : props.contentFromCLI;
      }

      const { lines } = await quicktypeJSON(
        "typescript",
        `FeezcoPage${pageAlias}`,
        JSON.stringify({ elements: appendedElements })
      );

      conditionalPageContentTypes = `${conditionalPageContentTypes}
  T extends FeezcoPagePath.${pageAlias} ? FeezcoPage${pageAlias}
  :
`;

      pagesEnum = `${pagesEnum}
  ${pageAlias} = '${pages[page].path}',
`;

      pageEnumDefinition = `${pageEnumDefinition}
FeezcoPagePath["${pageAlias}"] = "${pages[page].path}";
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
          return !["string", "boolean", "number", "void"].includes(
            eachInterface
          );
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

      const existingPageTsFile = readFileSync(
        `${__dirname}/basePage.d.ts`,
        "utf-8"
      )
        .split(
          `
// To parse this data:`
        )[0]
        .replace(`import { FeezcoPagePath } from './enum'\n`, "");

      const pageDTsExisting = readFileSync(`${__dirname}/page.d.ts`, "utf-8");

      const separator = "// ==============================================";

      const existingInterfacesPageTsFile = pageDTsExisting.split(
        pageDTsExisting.indexOf(pageDTsExisting) > -1
          ? `
${separator}
`
          : `
// match the expected interface, even if the JSON is valid.
`
      )[1];

      writeFileSync(
        `${__dirname}/page.d.ts`,
        `${existingPageTsFile}
${existingInterfacesPageTsFile ? `${separator}
${existingInterfacesPageTsFile}` : separator}
${replacedPageInterfaces}
    `
      );

      await new Promise((resolve) => {
        setTimeout(() => {
          resolve(true);
        }, 10000);
      });
    }

    writeFileSync(
      `${process.cwd()}/feezco.placeholders.json`,
      JSON.stringify(feezcoElementsFromJSONParsed, null, 2)
    );

    enumJsFileContent = enumJsFileContent.replace(
      enumContentToReplace || contentToReplace,
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

  await generateTypes();
};

if (args[0] === "create") {
  inquirer
    .prompt({
      type: "list",
      name: "page",
      message: "Which page do you want this content exists on?",
      choices: Object.keys(pages),
    })
    .then((answers1) => {
      inquirer
        .prompt({
          name: "id",
          message:
            "Set unique feezco-id for this content element (e.g. text-1, img-1, etc):",
          validate: async (feezcoId) => {
            if (!feezcoId) {
              return "feezco-id cannot be empty";
            }

            const re = /^[a-zA-Z0-9_-]+$/;
            if (!re.test(feezcoId)) {
              return "Only letters, numbers, -, _ are allowed";
            }

            const getPageRes = await axios.get(
              `https://cdn.feezco.com/page?path=${
                pages[answers1.page]
              }&key=${key}&stage=${process.env.FEEZCO_STAGE}`
            );

            const elements = getPageRes.data.elements;

            if (elements[feezcoId]) {
              return `feezco-id "${feezcoId}" already exists!`;
            }

            return true;
          },
        })
        .then(async (answers2) => {
          inquirer
            .prompt([
              {
                type: "list",
                name: "tagname",
                message:
                  "Which HTML element do you want this content rendered as?",
                choices: ["a", "button", "div", "h1", "h2", "h3", "img", "p"],
              },
              {
                type: "checkbox",
                name: "styles",
                message: "Which style properties do you want to control?",
                choices: [
                  "background",
                  "backgroundColor",
                  "border",
                  "color",
                  "height",
                  "fontSize",
                  "fontWeight",
                  "width",
                ],
              },
            ])
            .then(async (answers3) => {
              const styleValuePrompts = answers3.styles.map(
                (eachStyle: string, i: number) => {
                  return {
                    name: `styleValue${i + 1}`,
                    message: `Set value for ${eachStyle}:`,
                    validate: async (styleValue: string) => {
                      if (!styleValue) {
                        return "style value cannot be empty";
                      }

                      return true;
                    },
                  };
                }
              );
              const styleValueAnswers = await inquirer.prompt(
                styleValuePrompts
              );

              const styleObject: Record<string, string> = {};

              for (let i = 0; i < answers3.styles.length; i++) {
                styleObject[answers3.styles[i]] =
                  styleValueAnswers[`styleValue${i + 1}`];
              }

              feezcoGenerate({
                page: answers1.page,
                contentFromCLI: {
                  [answers2.id]: {
                    tag: answers3.tagname,
                    data: "data",
                    attributes: {
                      style: {
                        object: {
                          regular: styleObject,
                          important: styleObject,
                        },
                        string: {
                          regular: styleObjectToString({ styleObject }),
                          important: styleObjectToString({
                            styleObject,
                            isImportant: true,
                          }),
                        },
                      },
                    },
                  },
                },
              }).then(() => {
                console.log(clc.green("Feezco types generated successfully!"));
              });
            })
            .catch((error) => {
              console.log("error:", error);
              if (error.isTtyError) {
                // Prompt couldn't be rendered in the current environment
              } else {
                // Something else went wrong
              }
            });
        });
    });
} else if (args[0] === "generate") {
  feezcoGenerate().then(() => {
    console.log(clc.green("Feezco types generated successfully!"));
  });
} else if (args[0] === "sync") {
  if (existsSync(`${__dirname}/cachedContentData.json`)) {
    rmSync(`${__dirname}/cachedContentData.json`);
  }
}
