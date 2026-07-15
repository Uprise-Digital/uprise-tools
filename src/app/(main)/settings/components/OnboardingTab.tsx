"use client";

import {
  addEdge,
  Background,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import {
  AlertTriangle,
  Database,
  Mail,
  RefreshCw,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import "@xyflow/react/dist/style.css";
import {
  disconnectGoogleDriveAction,
  saveOnboardingSettingsAction,
} from "@/actions/onboarding-settings.actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { EmailPreview } from "./EmailPreview";

interface OnboardingTabProps {
  onboardingSettings: {
    id: number;
    googleDriveEnabled: boolean;
    googleDriveParentFolderId: string;
    googleDriveTemplateFolderId: string;
    googleDriveEmail: string;
    googleDriveStatus: string;
    googleDriveError: string;
    notionEnabled: boolean;
    notionApiKey: string;
    notionParentPageId: string;
    notionTemplatePageId: string;
    notionStatus: string;
    notionError: string;
    welcomeEmailSubject: string;
    welcomeEmailTemplate: string;
    workflowConfig: any;
  } | null;
  orgName: string;
  orgId: string;
}

// React Flow Custom Node Definitions
function CustomTriggerNode({ id, data }: any) {
  return (
    <div className="relative bg-white border border-slate-200 rounded-xl shadow-sm p-3.5 min-w-[200px] flex items-center gap-3 font-sans transition-all hover:shadow-md border-l-4 border-l-emerald-500">
      <div className="w-10 h-10 shrink-0 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-100/50">
        <img
          src="/images/logos/trigger.svg"
          alt="Start"
          className="w-5.5 h-5.5 select-none"
        />
      </div>
      <div className="text-left">
        <p className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider">
          Trigger Event
        </p>
        <p className="text-[11px] font-bold text-slate-800 leading-tight">
          {data.label}
        </p>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full !right-[-5px]"
      />
    </div>
  );
}

function CustomDriveNode({ id, data }: any) {
  return (
    <div className="relative bg-white border border-slate-200 rounded-xl shadow-sm p-3.5 min-w-[210px] flex items-center gap-3 font-sans transition-all hover:shadow-md border-l-4 border-l-blue-500 group">
      <Handle
        type="target"
        position={Position.Left}
        className="w-2.5 h-2.5 bg-blue-500 border-2 border-white rounded-full !left-[-5px]"
      />
      <div className="w-10 h-10 shrink-0 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-100/50">
        <img
          src="/images/logos/google-drive.svg"
          alt="Google Drive"
          className="w-5.5 h-5.5 select-none"
        />
      </div>
      <div className="text-left flex-1">
        <p className="text-[9px] font-extrabold text-blue-600 uppercase tracking-wider">
          Google Workspace
        </p>
        <p className="text-[11px] font-bold text-slate-800 leading-tight">
          {data.label}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          data.onDeleteNode?.(id);
        }}
        className="nodrag absolute -top-2 -right-2 w-5.5 h-5.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md border border-white cursor-pointer z-50 text-[10px] font-bold transition-transform transform hover:scale-110"
      >
        ✕
      </button>
      <Handle
        type="source"
        position={Position.Right}
        className="w-2.5 h-2.5 bg-blue-500 border-2 border-white rounded-full !right-[-5px]"
      />
    </div>
  );
}

function CustomNotionNode({ id, data }: any) {
  return (
    <div className="relative bg-white border border-slate-200 rounded-xl shadow-sm p-3.5 min-w-[210px] flex items-center gap-3 font-sans transition-all hover:shadow-md border-l-4 border-l-slate-900 group">
      <Handle
        type="target"
        position={Position.Left}
        className="w-2.5 h-2.5 bg-slate-900 border-2 border-white rounded-full !left-[-5px]"
      />
      <div className="w-10 h-10 shrink-0 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200">
        <img
          src="/images/logos/notion.svg"
          alt="Notion"
          className="w-5.5 h-5.5 select-none"
        />
      </div>
      <div className="text-left flex-1">
        <p className="text-[9px] font-extrabold text-slate-800 uppercase tracking-wider">
          Notion Portal
        </p>
        <p className="text-[11px] font-bold text-slate-800 leading-tight">
          {data.label}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          data.onDeleteNode?.(id);
        }}
        className="nodrag absolute -top-2 -right-2 w-5.5 h-5.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md border border-white cursor-pointer z-50 text-[10px] font-bold transition-transform transform hover:scale-110"
      >
        ✕
      </button>
      <Handle
        type="source"
        position={Position.Right}
        className="w-2.5 h-2.5 bg-slate-900 border-2 border-white rounded-full !right-[-5px]"
      />
    </div>
  );
}

function CustomEmailNode({ id, data }: any) {
  return (
    <div className="relative bg-white border border-slate-200 rounded-xl shadow-sm p-3.5 min-w-[200px] flex items-center gap-3 font-sans transition-all hover:shadow-md border-l-4 border-l-indigo-600 group">
      <Handle
        type="target"
        position={Position.Left}
        className="w-2.5 h-2.5 bg-indigo-600 border-2 border-white rounded-full !left-[-5px]"
      />
      <div className="w-10 h-10 shrink-0 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100/50">
        <img
          src="/images/logos/email.svg"
          alt="Welcome Email"
          className="w-5.5 h-5.5 select-none"
        />
      </div>
      <div className="text-left flex-1">
        <p className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider">
          Email Delivery
        </p>
        <p className="text-[11px] font-bold text-slate-800 leading-tight">
          {data.label}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          data.onDeleteNode?.(id);
        }}
        className="nodrag absolute -top-2 -right-2 w-5.5 h-5.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md border border-white cursor-pointer z-50 text-[10px] font-bold transition-transform transform hover:scale-110"
      >
        ✕
      </button>
    </div>
  );
}

const nodeTypes = {
  customTrigger: CustomTriggerNode,
  customDrive: CustomDriveNode,
  customNotion: CustomNotionNode,
  customEmail: CustomEmailNode,
};

export function OnboardingTab({
  onboardingSettings,
  orgName,
  orgId,
}: OnboardingTabProps) {
  const [googleDriveEnabled, setGoogleDriveEnabled] = useState(
    onboardingSettings?.googleDriveEnabled ?? false,
  );
  const [googleDriveParentFolderId, setGoogleDriveParentFolderId] = useState(
    onboardingSettings?.googleDriveParentFolderId ?? "",
  );
  const [googleDriveTemplateFolderId, setGoogleDriveTemplateFolderId] =
    useState(onboardingSettings?.googleDriveTemplateFolderId ?? "");
  const [googleDriveStatus, setGoogleDriveStatus] = useState(
    onboardingSettings?.googleDriveStatus ?? "unconfigured",
  );
  const [googleDriveError, setGoogleDriveError] = useState(
    onboardingSettings?.googleDriveError ?? "",
  );
  const [googleDriveEmail, setGoogleDriveEmail] = useState(
    onboardingSettings?.googleDriveEmail ?? "",
  );

  const [notionEnabled, setNotionEnabled] = useState(
    onboardingSettings?.notionEnabled ?? false,
  );
  const [notionApiKey, setNotionApiKey] = useState(
    onboardingSettings?.notionApiKey ?? "",
  );
  const [notionParentPageId, setNotionParentPageId] = useState(
    onboardingSettings?.notionParentPageId ?? "",
  );
  const [notionTemplatePageId, setNotionTemplatePageId] = useState(
    onboardingSettings?.notionTemplatePageId ?? "",
  );
  const [notionStatus, setNotionStatus] = useState(
    onboardingSettings?.notionStatus ?? "unconfigured",
  );
  const [notionError, setNotionError] = useState(
    onboardingSettings?.notionError ?? "",
  );

  const defaultSubject = `Welcome to ${orgName} - Let's get started!`;
  const defaultBody = `Hi {{primary_contact_name}},

Great to have you on board!
Firstly, thank you for booking your onboarding call - we're looking forward to it.

To help us hit the ground running, we'd really appreciate it if you could complete the steps below before your onboarding call:

1. Upload Media Assets
To help us with creating your ad assets, I've created your Google Drive Folder: {{drive_link}}.
Please upload all your media assets like photos, videos, and logos (preferably in high-quality PNG format) inside the folder.

2. Client Dashboard
You can access the {{notion_link}} dashboard here. We'll use this dashboard to record all details discussed during the onboarding call for your reference.

3. Join Signal Group
Here's a link to your Signal Group so we can communicate instantly. Please click the links below:
- Download Signal: [Apple](https://apps.apple.com/us/app/signal-private-messenger/id874139669) | [Android](https://play.google.com/store/apps/details?id=org.thoughtcrime.secureshare)
- Join group chat: {{signal_link}}

Feel free to reach out if you have any questions or concerns. We are here to help!

Best,
Founder | ${orgName}`;

  const [welcomeEmailSubject, setWelcomeEmailSubject] = useState(
    onboardingSettings?.welcomeEmailSubject || defaultSubject,
  );
  const [welcomeEmailTemplate, setWelcomeEmailTemplate] = useState(
    onboardingSettings?.welcomeEmailTemplate || defaultBody,
  );

  const [isOnboardingSaving, setIsOnboardingSaving] = useState(false);
  const [isGoogleDriveDisconnecting, setIsGoogleDriveDisconnecting] =
    useState(false);

  // Flowchart Nodes & Edges Load Migration
  const rawNodes = onboardingSettings?.workflowConfig?.nodes;
  const initialNodes = rawNodes
    ? rawNodes.map((n: any) => {
        let type = n.type;
        if (type === "input" || n.id === "trigger") type = "customTrigger";
        else if (n.id === "google-drive") type = "customDrive";
        else if (n.id === "notion") type = "customNotion";
        else if (type === "output" || n.id === "email") type = "customEmail";

        let position = n.position;
        if (n.id === "trigger" && position.y === 150) {
          position = { x: 50, y: 120 };
        } else if (
          n.id === "google-drive" &&
          (position.y === 50 || position.x === 280)
        ) {
          position = { x: 300, y: 120 };
        } else if (
          n.id === "notion" &&
          (position.y === 250 || position.x === 280)
        ) {
          position = { x: 580, y: 120 };
        } else if (
          n.id === "email" &&
          (position.x === 520 || position.x === 550)
        ) {
          position = { x: 860, y: 120 };
        }

        return {
          ...n,
          type,
          position,
          style: undefined,
        };
      })
    : [
        {
          id: "trigger",
          type: "customTrigger",
          data: { label: "Client Onboarded (Start)" },
          position: { x: 50, y: 120 },
        },
        {
          id: "google-drive",
          type: "customDrive",
          data: { label: "Google Drive Automation" },
          position: { x: 300, y: 120 },
        },
        {
          id: "notion",
          type: "customNotion",
          data: { label: "Notion Dashboard Automation" },
          position: { x: 580, y: 120 },
        },
        {
          id: "email",
          type: "customEmail",
          data: { label: "Send Welcome Email" },
          position: { x: 860, y: 120 },
        },
      ];

  const rawEdges = onboardingSettings?.workflowConfig?.edges;
  const isOldParallelLayout =
    rawEdges?.some(
      (e: any) => e.source === "trigger" && e.target === "notion",
    ) &&
    rawEdges.some(
      (e: any) => e.source === "trigger" && e.target === "google-drive",
    );

  const initialEdges =
    rawEdges && !isOldParallelLayout
      ? rawEdges.map((e: any) => ({ ...e, animated: true }))
      : [
          {
            id: "e-trig-drive",
            source: "trigger",
            target: "google-drive",
            animated: true,
          },
          {
            id: "e-drive-notion",
            source: "google-drive",
            target: "notion",
            animated: true,
          },
          {
            id: "e-notion-email",
            source: "notion",
            target: "email",
            animated: true,
          },
        ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleDeleteNodeById = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId),
      );
    },
    [setNodes, setEdges],
  );

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.data.onDeleteNode) return node;
        return {
          ...node,
          data: {
            ...node.data,
            onDeleteNode: handleDeleteNodeById,
          },
        };
      }),
    );
  }, [handleDeleteNodeById, setNodes]);

  const onConnect = useCallback(
    (params: any) =>
      setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  );

  const handleAddNode = (nodeType: "google-drive" | "notion" | "email") => {
    const exists = nodes.some((n) => n.id === nodeType);
    if (exists) {
      toast.warning(`${nodeType} node already exists on canvas.`);
      return;
    }

    let type = "";
    let label = "";
    let x = 100;
    const y = 120;

    if (nodeType === "google-drive") {
      type = "customDrive";
      label = "Google Drive Automation";
      x = 300;
    } else if (nodeType === "notion") {
      type = "customNotion";
      label = "Notion Dashboard Automation";
      x = 580;
    } else if (nodeType === "email") {
      type = "customEmail";
      label = "Send Welcome Email";
      x = 860;
    }

    const newNode = {
      id: nodeType,
      type,
      position: { x, y },
      data: { label, onDeleteNode: handleDeleteNodeById },
    };

    setNodes((nds) => [...nds, newNode]);
    toast.success(`Added ${nodeType} node to flowchart.`);
  };

  const handleResetFlowchart = () => {
    const resetNodes = [
      {
        id: "trigger",
        type: "customTrigger",
        data: { label: "Client Onboarded (Start)" },
        position: { x: 50, y: 120 },
      },
      {
        id: "google-drive",
        type: "customDrive",
        data: { label: "Google Drive Automation" },
        position: { x: 300, y: 120 },
      },
      {
        id: "notion",
        type: "customNotion",
        data: { label: "Notion Dashboard Automation" },
        position: { x: 580, y: 120 },
      },
      {
        id: "email",
        type: "customEmail",
        data: { label: "Send Welcome Email" },
        position: { x: 860, y: 120 },
      },
    ];
    const resetEdges = [
      {
        id: "e-trig-drive",
        source: "trigger",
        target: "google-drive",
        animated: true,
      },
      {
        id: "e-drive-notion",
        source: "google-drive",
        target: "notion",
        animated: true,
      },
      {
        id: "e-notion-email",
        source: "notion",
        target: "email",
        animated: true,
      },
    ];
    setNodes(resetNodes);
    setEdges(resetEdges);
    toast.success("Workflow reset to default onboarding sequence.");
  };

  const handleConnectGoogleDrive = () => {
    window.location.href = `/api/auth/google-drive/connect?orgId=${orgId}`;
  };

  const handleDisconnectGoogleDrive = async () => {
    setIsGoogleDriveDisconnecting(true);
    const toastId = toast.loading("Disconnecting Google Drive connection...");
    try {
      const res = await disconnectGoogleDriveAction();
      if (res.success) {
        setGoogleDriveEmail("");
        setGoogleDriveStatus("unconfigured");
        setGoogleDriveError("");
        toast.success("Google Drive disconnected successfully!", {
          id: toastId,
        });
      } else {
        toast.error(res.error || "Failed to disconnect Google Drive.", {
          id: toastId,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.", { id: toastId });
    } finally {
      setIsGoogleDriveDisconnecting(false);
    }
  };

  const handleSaveOnboardingSettings = async () => {
    setIsOnboardingSaving(true);
    const toastId = toast.loading(
      "Saving onboarding configurations and verifying connections...",
    );
    try {
      const res = await saveOnboardingSettingsAction({
        googleDriveEnabled,
        googleDriveParentFolderId,
        googleDriveTemplateFolderId,
        notionEnabled,
        notionApiKey,
        notionParentPageId,
        notionTemplatePageId,
        welcomeEmailSubject,
        welcomeEmailTemplate,
        workflowConfig: {
          nodes,
          edges,
        },
      });

      if (res.success && res.validation) {
        setGoogleDriveStatus(res.validation.googleDriveStatus);
        setGoogleDriveError(res.validation.googleDriveError || "");
        setNotionStatus(res.validation.notionStatus);
        setNotionError(res.validation.notionError || "");

        const isNotionValid =
          !notionEnabled || res.validation.notionStatus === "valid";
        const isDriveValid =
          !googleDriveEnabled || res.validation.googleDriveStatus === "valid";

        if (isNotionValid && isDriveValid) {
          toast.success(
            "Onboarding settings saved and verified successfully!",
            {
              id: toastId,
            },
          );
        } else {
          toast.error(
            "Settings saved, but connection checks failed. Please check errors.",
            { id: toastId },
          );
        }
      } else {
        toast.error(res.error || "Failed to save onboarding settings.", {
          id: toastId,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.", { id: toastId });
    } finally {
      setIsOnboardingSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-in fade-in duration-200">
      <div className="lg:col-span-2 space-y-6">
        {/* FLOWCHART CONFIGURATOR CARD */}
        <Card className="py-0 border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="bg-slate-50 border-b border-slate-100 p-5 shrink-0">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
              <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
              Visual Onboarding Pipeline Configurator
            </CardTitle>
            <CardDescription className="text-xs">
              Drag and connect onboarding steps to design your automation
              workflow. Link handles to establish step sequence dependencies.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 h-[450px] relative bg-slate-50/50">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              className="font-sans"
            >
              <Background color="#cbd5e1" gap={16} size={1} />
              <Controls className="!bg-white !border-slate-200 !shadow-sm !rounded-xl overflow-hidden !m-4" />
              <Panel
                position={"right" as any}
                className="bg-white/95 backdrop-blur border border-slate-200 shadow-md p-4 rounded-2xl flex flex-col gap-2.5 max-w-[200px] m-4"
              >
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Add Connector Node
                </span>
                <Button
                  onClick={() => handleAddNode("google-drive")}
                  disabled={nodes.some((n) => n.id === "google-drive")}
                  variant="outline"
                  className="w-full text-left justify-start font-bold text-xs h-9 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer flex gap-2"
                >
                  <img
                    src="/images/logos/google-drive.svg"
                    alt=""
                    className="w-4 h-4"
                  />
                  Google Drive
                </Button>
                <Button
                  onClick={() => handleAddNode("notion")}
                  disabled={nodes.some((n) => n.id === "notion")}
                  variant="outline"
                  className="w-full text-left justify-start font-bold text-xs h-9 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer flex gap-2"
                >
                  <img
                    src="/images/logos/notion.svg"
                    alt=""
                    className="w-4 h-4"
                  />
                  Notion Dashboard
                </Button>
                <div className="h-px bg-slate-100 my-1 w-full" />
                <Button
                  onClick={handleResetFlowchart}
                  variant="secondary"
                  className="w-full font-bold text-xs h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Reset Flowchart
                </Button>
              </Panel>
            </ReactFlow>
          </CardContent>
        </Card>

        {/* DRIVE AUTOMATION CARD */}
        <Card className="py-0 border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 p-5 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <Database className="w-4 h-4 text-blue-500" />
                Google Drive Onboarding Integration
              </CardTitle>
              <CardDescription className="text-xs">
                Automatically provisions a secure shared workspace folder on
                Google Drive for new client media assets.
              </CardDescription>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={googleDriveEnabled}
                onChange={(e) => setGoogleDriveEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650" />
            </label>
          </CardHeader>
          <CardContent
            className={cn(
              "p-6 space-y-4 transition-opacity duration-200",
              !googleDriveEnabled && "opacity-60",
            )}
          >
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="text-xs">
                <span className="font-extrabold text-slate-800 block">
                  OAuth Connector Status
                </span>
                {googleDriveEmail ? (
                  <span className="text-slate-500 mt-0.5 block">
                    Connected to{" "}
                    <strong className="text-indigo-600 font-bold">
                      {googleDriveEmail}
                    </strong>
                  </span>
                ) : (
                  <span className="text-slate-400 mt-0.5 block">
                    No active OAuth account connection linked.
                  </span>
                )}
              </div>
              {googleDriveEmail ? (
                <Button
                  onClick={handleDisconnectGoogleDrive}
                  disabled={isGoogleDriveDisconnecting}
                  variant="outline"
                  className="border-red-200 text-red-650 hover:bg-red-50 hover:text-red-700 font-bold text-xs h-8 cursor-pointer"
                >
                  {isGoogleDriveDisconnecting
                    ? "Disconnecting..."
                    : "Disconnect"}
                </Button>
              ) : (
                <Button
                  onClick={handleConnectGoogleDrive}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-8 cursor-pointer"
                >
                  Connect Account
                </Button>
              )}
            </div>

            {googleDriveStatus === "failed" && googleDriveError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 shadow-sm leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="font-semibold text-left">
                  <strong>Drive Verification Failed:</strong> {googleDriveError}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="driveParentFolder"
                  className="text-xs font-bold text-slate-700"
                >
                  Parent Storage Folder ID
                </Label>
                <Input
                  id="driveParentFolder"
                  value={googleDriveParentFolderId}
                  onChange={(e) => setGoogleDriveParentFolderId(e.target.value)}
                  disabled={!googleDriveEnabled}
                  className="text-xs bg-white"
                  placeholder="e.g. 1a2b3c4d5e..."
                />
                <p className="text-[10px] text-slate-450 leading-normal">
                  The Google Drive folder ID where all newly created client
                  directories will be stored.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="driveTemplateFolder"
                  className="text-xs font-bold text-slate-700"
                >
                  Template Folder ID (Optional)
                </Label>
                <Input
                  id="driveTemplateFolder"
                  value={googleDriveTemplateFolderId}
                  onChange={(e) =>
                    setGoogleDriveTemplateFolderId(e.target.value)
                  }
                  disabled={!googleDriveEnabled}
                  className="text-xs bg-white"
                  placeholder="e.g. 9z8y7x6w5v..."
                />
                <p className="text-[10px] text-slate-455 leading-normal">
                  If provided, new folders will copy structures, spreadsheets,
                  and briefing documents from this folder.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NOTION INTEGRATION CARD */}
        <Card className="py-0 border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 p-5 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <Database className="w-4 h-4 text-slate-900" />
                Notion Dashboard Onboarding Integration
              </CardTitle>
              <CardDescription className="text-xs">
                Creates a collaborative client dashboard in Notion based on your
                agency templates.
              </CardDescription>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={notionEnabled}
                onChange={(e) => setNotionEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650" />
            </label>
          </CardHeader>
          <CardContent
            className={cn(
              "p-6 space-y-4 transition-opacity duration-200",
              !notionEnabled && "opacity-60",
            )}
          >
            {notionStatus === "failed" && notionError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 shadow-sm leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="font-semibold text-left">
                  <strong>Notion Verification Failed:</strong> {notionError}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="notionApiKey"
                  className="text-xs font-bold text-slate-700"
                >
                  Notion Internal Integration Token (API Key)
                </Label>
                <Input
                  id="notionApiKey"
                  type="password"
                  value={notionApiKey}
                  onChange={(e) => setNotionApiKey(e.target.value)}
                  disabled={!notionEnabled}
                  className="text-xs bg-white font-mono"
                  placeholder="secret_..."
                />
                <p className="text-[10px] text-slate-455 leading-normal">
                  Your Notion integration secret key. Make sure the parent page
                  is shared with this integration.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="notionParentPage"
                    className="text-xs font-bold text-slate-700"
                  >
                    Parent Dashboard Page ID
                  </Label>
                  <Input
                    id="notionParentPage"
                    value={notionParentPageId}
                    onChange={(e) => setNotionParentPageId(e.target.value)}
                    disabled={!notionEnabled}
                    className="text-xs bg-white"
                    placeholder="e.g. c3f4b5d6e7f8..."
                  />
                  <p className="text-[10px] text-slate-450 leading-normal">
                    The ID of the parent database or page where new client
                    dashboards will be created.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="notionTemplatePage"
                    className="text-xs font-bold text-slate-700"
                  >
                    Template Page ID
                  </Label>
                  <Input
                    id="notionTemplatePage"
                    value={notionTemplatePageId}
                    onChange={(e) => setNotionTemplatePageId(e.target.value)}
                    disabled={!notionEnabled}
                    className="text-xs bg-white"
                    placeholder="e.g. 5a4b3c2d1e0f..."
                  />
                  <p className="text-[10px] text-slate-450 leading-normal">
                    The ID of the template page inside your workspace. New
                    client dashboards will copy this block structure.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CUSTOM EMAIL CARD */}
        <Card className="py-0 border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
              <Mail className="w-4 h-4 text-indigo-500" />
              Custom Welcome Email Template
            </CardTitle>
            <CardDescription className="text-xs">
              Customize the onboarding email message sent to new clients.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email-subject"
                    className="text-xs font-bold text-slate-700"
                  >
                    Email Subject
                  </Label>
                  <Input
                    id="email-subject"
                    value={welcomeEmailSubject}
                    onChange={(e) => setWelcomeEmailSubject(e.target.value)}
                    className="text-xs bg-white"
                    placeholder="Welcome to our agency - Let's get started!"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="email-body"
                    className="text-xs font-bold text-slate-700"
                  >
                    Email Body Template (Plain Text or Markdown)
                  </Label>
                  <textarea
                    id="email-body"
                    value={welcomeEmailTemplate}
                    onChange={(e) => setWelcomeEmailTemplate(e.target.value)}
                    className="w-full min-h-[320px] text-xs font-mono p-3.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none leading-relaxed text-slate-700 resize-y"
                    placeholder="Hi {{primary_contact_name}}, ..."
                  />
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2 text-xs">
                  <span className="font-extrabold text-slate-700 block">
                    Supported Template Variables:
                  </span>
                  <ul className="list-disc pl-4 space-y-1.5 text-slate-550 leading-relaxed">
                    <li>
                      <code className="text-indigo-650 font-bold font-mono text-[10px]">
                        {"{{primary_contact_name}}"}
                      </code>{" "}
                      - The contact person's name
                    </li>
                    <li>
                      <code className="text-indigo-650 font-bold font-mono text-[10px]">
                        {"{{client_name}}"}
                      </code>{" "}
                      - The client company's name
                    </li>
                    <li>
                      <code className="text-indigo-650 font-bold font-mono text-[10px]">
                        {"{{drive_link}}"}
                      </code>{" "}
                      - The generated Google Drive folder link
                    </li>
                    <li>
                      <code className="text-indigo-650 font-bold font-mono text-[10px]">
                        {"{{notion_link}}"}
                      </code>{" "}
                      - The generated Notion client dashboard link
                    </li>
                    <li>
                      <code className="text-indigo-650 font-bold font-mono text-[10px]">
                        {"{{signal_link}}"}
                      </code>{" "}
                      - The generated Signal group invite link
                    </li>
                  </ul>
                </div>
              </div>

              <div className="xl:sticky xl:top-4">
                <EmailPreview
                  subject={welcomeEmailSubject}
                  body={welcomeEmailTemplate}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1 space-y-6">
        <Card className="py-0 border-slate-200 shadow-sm overflow-hidden sticky top-4">
          <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
              Onboarding Integration Panel
            </CardTitle>
            <CardDescription className="text-xs">
              Save your settings to verify Drive & Notion connection keys.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 text-xs text-slate-500 leading-relaxed space-y-4">
            <p>
              Toggle integrations on/off at the top of their cards. When
              enabled, Uprise Digital will trigger folder provisioning and
              workspace creations on every new client submit.
            </p>
            <div className="flex gap-2 justify-end pt-2 border-t w-full">
              <Button
                disabled={isOnboardingSaving}
                onClick={handleSaveOnboardingSettings}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 flex items-center justify-center gap-1.5"
              >
                {isOnboardingSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving settings...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Configurations
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
