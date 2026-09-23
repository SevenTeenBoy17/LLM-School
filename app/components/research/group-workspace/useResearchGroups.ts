"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GroupIndex, GroupSnapshot } from "@/lib/research-groups";
import { assertViewer, GroupRequestError, isGroupIndex, isGroupSnapshot, isLeaveResult, requestGroup, type GroupMutation, type MutationResult } from "./api";

export function useResearchGroups(ownerId: string) {
  const [index, setIndex] = useState<GroupIndex | null>(null);
  const [snapshot, setSnapshot] = useState<GroupSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [identityFailed, setIdentityFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [verifiedAfterUncertain, setVerifiedAfterUncertain] = useState(false);
  const live = useRef(false);
  const epoch = useRef(0);
  const selected = useRef("");
  const currentIndex = useRef<GroupIndex | null>(null);
  const currentSnapshot = useRef<GroupSnapshot | null>(null);
  const readController = useRef<AbortController | null>(null);
  const writeController = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const uncertainRef = useRef(false);
  const identityBlocked = useRef(false);

  const clearPrivateData = useCallback(() => {
    identityBlocked.current = true;
    currentIndex.current = null;
    currentSnapshot.current = null;
    setIndex(null);
    setSnapshot(null);
    setIdentityFailed(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!live.current || writing.current || identityBlocked.current || document.visibilityState !== "visible" || !document.hasFocus()) return;
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    const ticket = ++epoch.current;
    const valid = () => live.current && epoch.current === ticket && !controller.signal.aborted;
    setSyncing(true);
    try {
      const nextIndex = await requestGroup("/api/research-groups", isGroupIndex, controller.signal);
      if (!valid()) return;
      assertViewer(nextIndex, ownerId);
      currentIndex.current = nextIndex;
      setIndex(nextIndex);
      const target = nextIndex.groups.some((group) => group.id === selected.current)
        ? selected.current : nextIndex.groups[0]?.id ?? "";
      if (target !== selected.current) {
        selected.current = target;
        setSelectedId(target);
        currentSnapshot.current = null;
        setSnapshot(null);
      }
      if (target) {
        const nextSnapshot = await requestGroup(`/api/research-groups/${encodeURIComponent(target)}`, isGroupSnapshot, controller.signal);
        if (!valid()) return;
        assertViewer(nextSnapshot, ownerId);
        if (nextSnapshot.group.id !== target) throw new GroupRequestError("返回的教研组与当前选择不一致，请重新同步。", "INVALID_RESPONSE");
        currentSnapshot.current = nextSnapshot;
        setSnapshot(nextSnapshot);
      }
      setLastSync(Date.now());
      setError("");
      if (uncertainRef.current) setVerifiedAfterUncertain(true);
    } catch (cause) {
      if (!valid()) return;
      const failure = cause instanceof GroupRequestError ? cause : new GroupRequestError("同步失败，请重试。");
      if (failure.code === "IDENTITY_CHANGED" || failure.status === 401) clearPrivateData();
      if (failure.status === 403 || failure.status === 404) {
        currentSnapshot.current = null;
        setSnapshot(null);
      }
      if (failure.status === 403) {
        currentIndex.current = null;
        setIndex(null);
      }
      setError(failure.message);
    } finally {
      if (valid()) setSyncing(false);
      if (readController.current === controller) readController.current = null;
    }
  }, [clearPrivateData, ownerId]);

  useEffect(() => {
    live.current = true;
    const visible = () => document.visibilityState === "visible" && document.hasFocus();
    const wake = () => {
      setPaused(!visible());
      if (visible()) void refresh();
      else {
        readController.current?.abort();
        epoch.current += 1;
        setSyncing(false);
      }
    };
    const initial = window.setTimeout(wake, 0);
    const timer = window.setInterval(() => { if (visible() && !readController.current) void refresh(); }, 3_000);
    window.addEventListener("focus", wake);
    window.addEventListener("blur", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      live.current = false;
      epoch.current += 1;
      readController.current?.abort();
      writeController.current?.abort();
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", wake);
      window.removeEventListener("blur", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [refresh]);

  useEffect(() => {
    if (!pending && !uncertain) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending, uncertain]);

  const selectGroup = useCallback((id: string) => {
    if (writing.current || id === selected.current || !currentIndex.current?.groups.some((group) => group.id === id)) return;
    readController.current?.abort();
    epoch.current += 1;
    selected.current = id;
    currentSnapshot.current = null;
    setSelectedId(id);
    setSnapshot(null);
    setError("");
    void refresh();
  }, [refresh]);

  const mutate = useCallback(async (input: GroupMutation): Promise<MutationResult> => {
    const viewer = currentIndex.current?.viewer;
    const current = currentSnapshot.current;
    if (!live.current || writing.current) return { ok: false, message: "当前请求仍在提交，请稍候。" };
    if (identityBlocked.current || !viewer || viewer.id !== ownerId) return { ok: false, message: "尚未确认当前身份，请先同步。" };
    if (uncertainRef.current) return { ok: false, message: "上次提交结果尚未核对，请先刷新并核对服务器状态。", uncertain: true };
    if (viewer.readOnly || current?.viewer.readOnly) return { ok: false, message: "当前为只读会话，不能修改教研组。" };
    if (document.visibilityState !== "visible" || !document.hasFocus()) return { ok: false, message: "请返回当前窗口，完成身份核对后再提交。" };
    if (input.kind === "action") {
      if (!current || current.group.id !== selected.current || current.viewer.id !== ownerId) return { ok: false, message: "教研组尚未完成同步，请重试。" };
      if ((input.action === "create-task" || input.action === "rotate-invite") && !current.viewer.isOwner) return { ok: false, message: "此操作仅限组长。" };
      if (input.action === "leave" && current.viewer.isOwner) return { ok: false, message: "当前版本不支持组长退出或转交教研组。" };
      if (input.action === "update-task") {
        const task = current.tasks.find((entry) => entry.id === input.taskId);
        if (!task || (!current.viewer.isOwner && task.assigneeId !== ownerId)) return { ok: false, message: "只有组长或任务负责人可以修改此任务。" };
      }
    }
    writing.current = true;
    setPending(true);
    setSyncing(false);
    readController.current?.abort();
    epoch.current += 1;
    const controller = new AbortController();
    writeController.current = controller;
    const groupId = selected.current;
    const { kind, ...body } = input;
    const path = kind === "create" ? "/api/research-groups" : kind === "join" ? "/api/research-groups/join" : `/api/research-groups/${encodeURIComponent(groupId)}`;
    try {
      if (kind === "action" && input.action === "leave") {
        await requestGroup(path, isLeaveResult, controller.signal, body);
        if (!live.current || controller.signal.aborted) return { ok: false, message: "请求已中断。", uncertain: true };
        selected.current = "";
        setSelectedId("");
        currentSnapshot.current = null;
        setSnapshot(null);
        const nextIndex = currentIndex.current ? { ...currentIndex.current, groups: currentIndex.current.groups.filter((group) => group.id !== groupId) } : null;
        currentIndex.current = nextIndex;
        setIndex(nextIndex);
      } else {
        const next = await requestGroup(path, isGroupSnapshot, controller.signal, body);
        if (!live.current || controller.signal.aborted) return { ok: false, message: "请求已中断。", uncertain: true };
        assertViewer(next, ownerId);
        if (kind === "action" && next.group.id !== groupId) throw new GroupRequestError("提交结果与当前教研组不一致，请重新同步核对。", "INVALID_RESPONSE", 200, true);
        selected.current = next.group.id;
        setSelectedId(next.group.id);
        currentSnapshot.current = next;
        setSnapshot(next);
        if (currentIndex.current) {
          const groups = currentIndex.current.groups.some((group) => group.id === next.group.id)
            ? currentIndex.current.groups.map((group) => group.id === next.group.id ? next.group : group)
            : [...currentIndex.current.groups, next.group];
          const nextIndex = { ...currentIndex.current, groups };
          currentIndex.current = nextIndex;
          setIndex(nextIndex);
        }
        setLastSync(Date.now());
      }
      setError("");
      return { ok: true };
    } catch (cause) {
      const failure = cause instanceof GroupRequestError ? cause : new GroupRequestError("无法确认提交结果，请重新同步核对。", "CONNECTION_FAILED", 0, true);
      if (live.current) {
        if (failure.code === "IDENTITY_CHANGED" || failure.status === 401) clearPrivateData();
        if (failure.uncertain) {
          uncertainRef.current = true;
          setUncertain(true);
          setVerifiedAfterUncertain(false);
        }
      }
      return { ok: false, message: failure.message, uncertain: failure.uncertain, conflict: failure.status === 409 };
    } finally {
      writing.current = false;
      writeController.current = null;
      if (live.current) {
        setPending(false);
        void refresh();
      }
    }
  }, [clearPrivateData, ownerId, refresh]);

  const acknowledgeUncertain = () => {
    if (!verifiedAfterUncertain) return;
    uncertainRef.current = false;
    setUncertain(false);
    setVerifiedAfterUncertain(false);
  };

  return { index, snapshot, selectedId, syncing, pending, error, identityFailed, paused, lastSync, uncertain, verifiedAfterUncertain, refresh, selectGroup, mutate, acknowledgeUncertain };
}

export type ResearchGroupsController = ReturnType<typeof useResearchGroups>;
