import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
export interface FeezcoPage {
  elements: Record<string, unknown>;
}

type PageContent<T> = T extends T ? T : T;

export const getPageContent = async <T>({
  path,
  key,
  env,
}: {
  path: string;
  key?: string;
  env?: string;
}): Promise<PageContent<T> | void> => {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const getCookie = (cname: string): string => {
      const name = cname + "=";
      const ca = document.cookie.split(";");
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == " ") {
          c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
          return c.substring(name.length, c.length);
        }
      }
      return "";
    };

    const setCookie = (cname: string, cvalue: string, exdays: number) => {
      const d = new Date();
      d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
      let expires = "expires=" + d.toUTCString();
      document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    };

    const populateMissingElementsBrowser = ({
      pagePath,
      data,
    }: {
      pagePath: string;
      data: Record<string, unknown>;
    }) => {
      return data;
    };

    const feezcoCachedContentFromCookie = getCookie("feezco_cached");

    const cachedContentDataRes =
      feezcoCachedContentFromCookie && process.env.FEEZCO_STAGE !== "PRODUCTION"
        ? JSON.parse(feezcoCachedContentFromCookie)
        : null;

    const resData =
      cachedContentDataRes ||
      ((
        await axios.get(
          `https://cdn.feezco.com/page?path=${path}&key=${key}&stage=${env}`
        )
      ).data as PageContent<T>);

    if (!cachedContentDataRes && resData) {
      setCookie("feezco_cached", JSON.stringify(resData), 100000);
    }

    // @ts-expect-error type error
    return populateMissingElementsBrowser({ pagePath: path, data: resData });
  } else {
    try {
      const { existsSync, readFileSync, writeFileSync } = await import("fs");

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

      const feezcoPlaceholdersParsed: Record<string, string> =
        feezcoPlaceholders ? JSON.parse(feezcoPlaceholders) : null;

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
          const missingElementsKeys = Object.keys(
            feezcoPlaceholdersParsed[key]
          );

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

      const cachedContentDataRes =
        existsSync(`${__dirname}/cachedContentData.json`) &&
        process.env.FEEZCO_STAGE !== "PRODUCTION"
          ? JSON.parse(
              readFileSync(`${__dirname}/cachedContentData.json`, "utf-8")
            )
          : null;

      const feezcoConfigObj = existsSync(`${process.cwd()}/feezco.config.json`)
        ? JSON.parse(
            readFileSync(`${process.cwd()}/feezco.config.json`, "utf-8")
          )
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
    } catch (err) {
      // error
    }
  }
};
