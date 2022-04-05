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
}: {
  path: T;
  key: string;
}): Promise<PageContent<T>> => {
  const res = (await axios.get(
    `https://cdn.feezco.com/page?path=${path}&key=${key}&stage=${process.env.FEEZCO_STAGE}`
  )) as { data: PageContent<T> };

  return res.data;
};
