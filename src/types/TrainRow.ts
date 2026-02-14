export type TrainRow = {
  trainNumber: string;
  type: string;
  destinationStationName: string;
  originStationName: string;
  originDepartureTime: string | null;
  stationName: string;
  stationDepartureTime: string | null;
  stationArrivalTime: string | null;
  destinationArrivalTime: string | null;
  kitaAyaseArrivalTime: string | null;
  kitaAyaseDepartureTime: string | null;
  ayaseArrivalTime: string | null;
  ayaseDepartureTime: string | null;
  yoyogiUeharaArrivalTime: string | null;
  yoyogiUeharaDepartureTime: string | null;
};
