import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { createMyMeterUpdateController, type MyMeterUpdateService } from "../../packages/client/src/update-controller";
import { createMockRemote, createMyMeterStore, MyMeterConversationView } from "../../packages/client/src";
import { MyMeterUpdateControl } from "../../packages/client/src/update-ui";

describe("MyMeter update UI", () => {
  test("renders check and install states", async () => {
    const service: MyMeterUpdateService = {
      checkLatest: vi.fn(async () => ({
        currentVersion: "0.1.0",
        latestVersion: "0.1.1",
        updateAvailable: true,
      })),
      installVersion: vi.fn(async (version) => ({ installedVersion: version })),
    };
    const controller = createMyMeterUpdateController({
      service,
      delay: async () => new Promise(() => {}),
      healthProbe: async () => true,
      reload: vi.fn(),
    });

    render(<MyMeterUpdateControl controller={controller} isLoopback={true} />);

    fireEvent.click(screen.getByRole("button", { name: "检查更新" }));
    expect(await screen.findByText("发现 MyMeter v0.1.1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "更新插件" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("MyMeter v0.1.1 已安装");
    expect(screen.getByRole("dialog")).toHaveTextContent("请回到运行 dsh 的终端手动重启");
  });

  test("shows latest and failure messages", async () => {
    const service: MyMeterUpdateService = {
      checkLatest: vi.fn(async () => ({
        currentVersion: "0.1.1",
        latestVersion: "0.1.1",
        updateAvailable: false,
      })),
      installVersion: vi.fn(),
    };
    const controller = createMyMeterUpdateController({ service });
    const { rerender } = render(<MyMeterUpdateControl controller={controller} isLoopback={true} />);

    fireEvent.click(screen.getByRole("button", { name: "检查更新" }));
    expect(await screen.findByText("当前已是最新版 v0.1.1")).toBeInTheDocument();

    service.checkLatest = vi.fn(async () => {
      throw new Error("registry unavailable");
    });
    act(() => controller.reset());
    rerender(<MyMeterUpdateControl controller={controller} isLoopback={true} />);

    fireEvent.click(screen.getByRole("button", { name: "检查更新" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("registry unavailable");
  });

  test("shows the running version when it is newer than the registry latest", async () => {
    const controller = createMyMeterUpdateController({
      service: {
        checkLatest: vi.fn(async () => ({
          currentVersion: "0.2.0",
          latestVersion: "0.1.9",
          updateAvailable: false,
        })),
        installVersion: vi.fn(),
      },
    });

    render(<MyMeterUpdateControl controller={controller} isLoopback={true} />);
    fireEvent.click(screen.getByRole("button", { name: "检查更新" }));

    expect(await screen.findByText("当前已是最新版 v0.2.0")).toBeInTheDocument();
  });

  test("only renders update actions on loopback pages", () => {
    const service: MyMeterUpdateService = {
      checkLatest: vi.fn(),
      installVersion: vi.fn(),
    };
    const controller = createMyMeterUpdateController({ service });
    const { rerender } = render(<MyMeterUpdateControl controller={controller} isLoopback={false} />);

    expect(screen.queryByRole("button", { name: "检查更新" })).toBeNull();

    rerender(<MyMeterUpdateControl controller={controller} isLoopback={true} />);
    expect(screen.getByRole("button", { name: "检查更新" })).toBeInTheDocument();
  });

  test("conversation view places the update control beside the billing overlay switch", () => {
    const controller = createMyMeterUpdateController({
      service: {
        checkLatest: vi.fn(),
        installVersion: vi.fn(),
      },
    });
    const store = createMyMeterStore({ remote: createMockRemote("billing"), storage: null });

    render(
      <MyMeterConversationView
        store={store}
        sessionId="sess-1"
        updateController={controller}
        showUpdateControl={true}
      />,
    );

    expect(screen.getByRole("button", { name: "检查更新" })).toBeInTheDocument();
    expect(screen.getByText("计费浮窗")).toBeInTheDocument();

    store.destroy();
    controller.dispose();
  });
});
