export type OperationVisualState = "normal" | "delay" | "suspended";

export type ParsedOperationInfo = {
  title: string;
  state: OperationVisualState;
};
