import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
export interface FeezcoPage {
  elements: Record<string, unknown>;
}

export const getPageContent = async <T>({
  path,
  key,
}: {
  path: string;
  key: string;
}): Promise<T> => {
  const res = (await axios.get(
    `https://cdn.feezco.com?path=${path}&key=${key}&stage=${process.env.FEEZCO_STAGE}`
  )) as { data: T };

  return res.data;
};
