"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GenerationProgress } from "@/components/common/GenerationProgress";
import { Upload, Check, ShieldCheck, FileText, Cpu, X } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiUploadKb, readTextFile, isTextFile } from "@/lib/client/kbApi";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUploaded?: () => void; // 上传成功后刷新父列表
}

const STEPS = ["选择文件", "归属知识库", "设置范围", "建立索引", "完成"];

export function UploadDialog({ open, onOpenChange, onUploaded }: Props) {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [kb, setKb] = useState("info-7");
  const [scope, setScope] = useState("self");
  const [uploadStartedAt, setUploadStartedAt] = useState<number>();
  const [dragging, setDragging] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const activeUploadRef = useRef<symbol | null>(null);

  useEffect(() => () => { activeUploadRef.current = null; }, []);

  // 真实上传：文本类文件读取全文，其余仅传元数据；逐个 POST /api/knowledge，按数量推进进度。
  const startUpload = async () => {
    if (!open || !files.length || activeUploadRef.current !== null) return;
    const run = Symbol("upload");
    activeUploadRef.current = run;
    setStep(3);
    setUploadStartedAt(Date.now());
    setUploadedCount(0);
    setFailedCount(0);
    let ok = 0, fail = 0;
    try {
      for (const f of files) {
        if (activeUploadRef.current !== run) return;
        try {
          const text = await readTextFile(f);
          if (activeUploadRef.current !== run) return;
          const res = await apiUploadKb({ name: f.name, sizeBytes: f.size, scope, textContent: text || undefined });
          if (activeUploadRef.current !== run) return;
          if (res) ok++; else fail++;
        } catch {
          if (activeUploadRef.current !== run) return;
          fail++;
        }
        setUploadedCount(ok);
        setFailedCount(fail);
      }
    } finally {
      if (activeUploadRef.current === run) {
        activeUploadRef.current = null;
        setStep(4);
        if (ok > 0) onUploaded?.();
      }
    }
  };

  const reset = () => { activeUploadRef.current = null; setStep(0); setFiles([]); setUploadStartedAt(undefined); setUploadedCount(0); setFailedCount(0); };
  const close = () => { reset(); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[calc(100dvh-24px)] max-w-2xl overflow-y-auto p-4 sm:p-6" hideClose>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>上传文件到知识库</DialogTitle>
              <DialogDescription>分 5 步完成上传、解析与上线，所有文件均会写入校内审计日志。</DialogDescription>
            </div>
            <button type="button" aria-label="Close upload dialog" onClick={close} className="grid h-[40px] w-[40px] place-items-center rounded-[12px] text-[var(--text-2)] hover:bg-[var(--rg-control-bg)]">
              <X size={16} />
            </button>
          </div>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="grid grid-cols-5 gap-2">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`rounded-[12px] px-2 py-2 text-center transition ${
                i === step ? "bg-[var(--rg-selected-bg)] text-[var(--c-primary)]" : i < step ? "bg-[var(--ok-bg)] text-[var(--c-growth)]" : "bg-[var(--bg)] text-[var(--text-3)]"
              }`}
            >
              <div className="text-num text-[16px] font-bold">{i < step ? "✓" : i + 1}</div>
              <div className="mt-0.5 text-[11px]">{label}</div>
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <div
              onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const fs = Array.from(e.dataTransfer?.files || []);
                if (fs.length) setFiles((cur) => [...cur, ...fs]);
              }}
              className={`relative grid place-items-center rounded-[20px] border-2 border-dashed p-5 text-center transition sm:p-10 ${
                dragging ? "border-[var(--c-edu)] bg-[var(--p-sky)]" : "border-[var(--border)] bg-[var(--rg-hover-bg)]"
              }`}
            >
              <div className="grid h-12 w-12 place-items-center rounded-[12px] bg-[var(--card)] text-[var(--c-edu)] shadow-md">
                <Upload size={22} />
              </div>
              <div className="mt-3 text-[14px] font-semibold">拖拽文件到此处上传</div>
              <div className="mt-1 text-[12px] text-[var(--text-2)]">支持 PDF / Word / PPT / Excel / 图片 · 单文件 ≤ 100MB</div>
              <label className="mt-3 inline-flex min-h-[40px] cursor-pointer items-center rounded-[12px] bg-[var(--c-primary)] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[var(--c-primary-2)]">
                选择本地文件
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const fs = Array.from(e.target.files || []);
                    if (fs.length) setFiles((cur) => [...cur, ...fs]);
                  }}
                />
              </label>
            </div>
            {files.length > 0 && (
              <div className="max-h-[190px] space-y-1.5 overflow-y-auto rounded-[12px] border border-[var(--border-2)] p-3 sm:max-h-none">
                <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">已选择 {files.length} 个文件</div>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-[13px]">
                    <FileText size={13} className="text-[var(--c-edu)]" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-[var(--text-3)]">{(f.size / 1024).toFixed(1)} KB</span>
                    {isTextFile(f.name)
                      ? <span className="rounded bg-[var(--ok-bg)] px-1.5 py-0.5 text-[11px] text-[var(--ok-ink)]">全文索引</span>
                      : <span className="rounded bg-[var(--rg-control-bg)] px-1.5 py-0.5 text-[11px] text-[var(--text-3)]">仅文件名</span>}
                    <button type="button" aria-label={`Remove file ${f.name}`} onClick={() => setFiles(files.filter((_, x) => x !== i))} className="grid h-[40px] w-[40px] place-items-center rounded-[12px] text-[var(--text-3)] hover:bg-[var(--err-bg)] hover:text-[var(--c-alert)]"><X size={13} /></button>
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-[var(--text-3)]">文本类文件（txt/md/csv…）会索引全文并可按正文检索；PDF/Word/PPT 等二进制暂只按文件名检索。</p>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">归属知识库</Label>
              <Select value={kb} onValueChange={setKb}>
                <SelectTrigger aria-label="归属知识库"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info-7">七年级信息科技课程库</SelectItem>
                  <SelectItem value="calc">高等数学（A）课程库</SelectItem>
                  <SelectItem value="rule">学校制度库</SelectItem>
                  <SelectItem value="mine">我的个人库</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-[12px] bg-[var(--rg-hover-bg)] p-3 text-[12px] text-[var(--text-2)] leading-[1.7]">
              所选知识库将作为这些文件的归属空间，权限按知识库的访问控制策略生效。
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">权限范围</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger aria-label="权限范围"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">仅本人</SelectItem>
                  <SelectItem value="course">课程成员（同班级可见）</SelectItem>
                  <SelectItem value="college">学部成员（同学段可见）</SelectItem>
                  <SelectItem value="all">全校公开</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-[12px] bg-[var(--rg-hover-bg)] p-3 text-[12px] leading-[1.7] text-[var(--text-2)]">
              上传后立即建立<strong className="text-[var(--text)]">关键词索引</strong>（非向量语义）。可见范围：<strong className="text-[var(--text)]">「仅本人」</strong>只你可见；<strong className="text-[var(--text)]">「课程成员」</strong>按真实班级关系（同 classId）对同班师生可见；<strong className="text-[var(--text)]">「学部成员」</strong>按真实学段关系（同 stage，初中部/高中部）对同学部师生可见；<strong className="text-[var(--text)]">「全校公开」</strong>所有人可见。文本类文件索引全文，二进制按文件名检索。
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 py-2">
            <GenerationProgress
              label="文件处理进度"
              completed={uploadedCount + failedCount}
              total={files.length}
              unit="个文件"
              startedAt={uploadStartedAt}
              detail={`成功 ${uploadedCount} 个，失败 ${failedCount} 个；当前文件：${files[uploadedCount + failedCount]?.name ?? "等待处理结果"}`}
            />
            <ul className="space-y-1.5 text-[12px] text-[var(--text-2)]">
              <li>上传文件元数据（文件名 / 大小 / 范围）</li>
              <li>提取文本（文本类文件）</li>
              <li>建立关键词索引与分段</li>
            </ul>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className={`flex items-center gap-3 rounded-[12px] p-4 ${failedCount > 0 ? "bg-[var(--warn-bg)]" : "bg-[var(--ok-bg)]"}`}>
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-white ${failedCount > 0 ? "bg-[var(--warn-ink)]" : "bg-[var(--c-growth)]"}`}>
                {failedCount > 0 ? <X size={18} /> : <Check size={18} />}
              </div>
              <div>
                <div className={`text-[14px] font-semibold ${failedCount > 0 ? "text-[var(--warn-ink)]" : "text-[var(--ok-ink)]"}`}>{failedCount > 0 ? "文件处理结束，存在未成功的上传" : "上传完成"}</div>
                <div className="text-[12px] text-[var(--text-2)]">成功 {uploadedCount} 个{failedCount > 0 ? ` · 失败 ${failedCount} 个` : ""}。{uploadedCount > 0 ? "成功文件已建立关键词索引。" : "尚无成功上传的文件。"}{failedCount > 0 ? "重试前请先检查列表，确认实际上传结果。" : "可回到列表检索或在详情页测试。"}</div>
              </div>
            </div>
            <div className="rounded-[12px] bg-[var(--rg-hover-bg)] p-3 text-[12px] text-[var(--text-2)]">
              <ShieldCheck className="inline text-[var(--c-growth)]" size={13} /> 成功上传会写入校内审计日志。检索为关键词匹配（非向量语义）。
            </div>
          </div>
        )}

        <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-[var(--border-2)] bg-[var(--card)] pt-3">
          <div className="text-[11px] text-[var(--text-3)]">步骤 {step + 1} / {STEPS.length}</div>
          <div className="flex gap-2">
            {step > 0 && step < 3 && <Button variant="outline" size="sm" className="min-h-[40px]" onClick={() => setStep((s) => s - 1)}>上一步</Button>}
            {step < 2 && <Button size="sm" className="min-h-[40px]" disabled={step === 0 && files.length === 0} onClick={() => setStep((s) => s + 1)}>下一步</Button>}
            {step === 2 && <Button size="sm" variant="grad" onClick={startUpload} className="min-h-[40px] gap-1.5"><Cpu size={13} /> 开始上传</Button>}
            {step === 4 && <Button size="sm" variant="grad" className="min-h-[40px]" onClick={close}>完成</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
