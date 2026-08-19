import type { MyMeterUpdateController } from "./update-controller";
export interface MyMeterUpdateControlProps {
    controller: MyMeterUpdateController;
    isLoopback: boolean;
}
export declare function MyMeterUpdateControl({ controller, isLoopback }: MyMeterUpdateControlProps): import("react").JSX.Element | null;
