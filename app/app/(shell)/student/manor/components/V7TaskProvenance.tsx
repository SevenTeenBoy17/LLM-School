import styles from "./learning-hub.module.css";

interface ProvenanceProps {
  assignmentId?: string | null;
  taskRunId?: string | null;
  resourceVersion?: string | null;
  datasetVersion?: string | null;
  sourceLabel?: string | null;
}

export function V7TaskProvenance({ assignmentId, taskRunId, resourceVersion, datasetVersion, sourceLabel }: ProvenanceProps) {
  if (!assignmentId && !taskRunId && !resourceVersion && !datasetVersion && !sourceLabel) return null;
  return <details className={styles.provenance}>
    <summary>任务来源与版本</summary>
    <dl>
      {sourceLabel && <><dt>数据来源</dt><dd>{sourceLabel}</dd></>}
      {assignmentId && <><dt>分派编号</dt><dd>{assignmentId}</dd></>}
      {taskRunId && <><dt>任务轮次</dt><dd>{taskRunId}</dd></>}
      {resourceVersion && <><dt>资源版本</dt><dd>{resourceVersion}</dd></>}
      {datasetVersion && <><dt>数据版本</dt><dd>{datasetVersion}</dd></>}
    </dl>
  </details>;
}
