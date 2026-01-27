export type OperationInfo = {
  railway: string;
  state: "normal" | "delay" | "suspended";
  text: string;
  operationDate?: string;
  originTime?: string | null;
  updatedAt: string;
};
