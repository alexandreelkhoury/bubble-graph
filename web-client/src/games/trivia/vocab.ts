// Quiz Night's content vocabulary labels (platform §5.4). Vocabulary ids are kebab-case ("cinema-tv", "arab-world");
// their string keys are camelCase ("content.topic.cinemaTv", "content.domain.arabWorld").
import { t } from "../../i18n/t";
import type { MessageKey } from "../../i18n/t";

export const vocabKey = (id: string): string => id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
export const domainLabel = (d: string): string => t(`content.domain.${vocabKey(d)}` as MessageKey);
export const topicLabel = (x: string): string => t(`content.topic.${vocabKey(x)}` as MessageKey);
