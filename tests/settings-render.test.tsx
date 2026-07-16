import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import SettingsClient from "../src/app/(main)/settings/pageClient";

describe("SettingsClient Rendering", () => {
  it("renders without crashing with null connection", () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsClient as any, {
        initialDefaults: {
          id: 1,
          criticalSpendThreshold: 70,
          criticalConversionsThreshold: 0,
          ctrHighThreshold: 7,
          ctrHighSpendThreshold: 50,
          cpcHighThreshold: 30,
          anomalySpendChangeThreshold: -30,
          anomalyConversionsChangeThreshold: -25,
        },
        accounts: [],
        auditLogs: [],
        emailLogs: [],
        connection: null,
        orgName: "Test Org",
        userEmail: "user@test.com",
        userRole: "admin",
        initialAutoJoinDomainEnabled: false,
      }),
    );
    console.log(
      "HTML (null connection) generated successfully, length:",
      html.length,
    );
  });

  it("renders without crashing with active connection", () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsClient as any, {
        initialDefaults: {
          id: 1,
          criticalSpendThreshold: 70,
          criticalConversionsThreshold: 0,
          ctrHighThreshold: 7,
          ctrHighSpendThreshold: 50,
          cpcHighThreshold: 30,
          anomalySpendChangeThreshold: -30,
          anomalyConversionsChangeThreshold: -25,
        },
        accounts: [
          {
            id: 1,
            googleAccountId: "1234567890",
            name: "Child Account",
            isActive: true,
            lastSyncedAt: null,
            syncStatus: null,
            syncError: null,
            includeInBriefing: true,
          },
        ],
        auditLogs: [],
        emailLogs: [],
        connection: {
          id: 1,
          connectedEmail: "manager@test.com",
          managerCustomerId: "1234567890",
          status: "active",
          errorMessage: null,
          createdAt: new Date().toISOString(),
        },
        orgName: "Test Org",
        userEmail: "user@test.com",
        userRole: "admin",
        initialAutoJoinDomainEnabled: false,
      }),
    );
    console.log(
      "HTML (active connection) generated successfully, length:",
      html.length,
    );
  });
});
