import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useEditorSettings } from "@/hooks/settings/use-editor-settings";
import {
  EDITOR_FONT_SIZE_OPTIONS,
  EDITOR_TAB_SIZE_OPTIONS,
  type EditorRenderWhitespace,
} from "@/lib/editor-settings";

import {
  SegmentedControl,
  SettingsGroup,
  SettingsPage,
  SettingsRow,
} from "../settings-primitives";

const WHITESPACE_OPTIONS: { id: EditorRenderWhitespace; label: string }[] = [
  { id: "none", label: "不显示" },
  { id: "boundary", label: "边界" },
  { id: "selection", label: "选中" },
  { id: "all", label: "全部" },
];

export function EditorSettings() {
  const { settings, updateSettings } = useEditorSettings();

  return (
    <SettingsPage
      title="编辑器"
      description="调整工作区文件编辑器的字体、显示与输入行为。"
    >
      <SettingsGroup title="显示">
        <SettingsRow label="字体大小">
          <Select
            value={String(settings.fontSize)}
            onValueChange={(value) => updateSettings({ fontSize: Number(value) })}
          >
            <SelectTrigger className="h-7 w-[88px] text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDITOR_FONT_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow label="行号">
          <Switch
            checked={settings.lineNumbers}
            onCheckedChange={(lineNumbers) => updateSettings({ lineNumbers })}
          />
        </SettingsRow>

        <SettingsRow label="小地图">
          <Switch
            checked={settings.minimap}
            onCheckedChange={(minimap) => updateSettings({ minimap })}
          />
        </SettingsRow>

        <SettingsRow label="显示空白字符">
          <SegmentedControl
            value={settings.renderWhitespace}
            options={WHITESPACE_OPTIONS}
            onChange={(renderWhitespace) => updateSettings({ renderWhitespace })}
          />
        </SettingsRow>

        <SettingsRow
          label="滚动超出末行"
          description="允许将内容滚动到编辑器底部留白区域。"
        >
          <Switch
            checked={settings.scrollBeyondLastLine}
            onCheckedChange={(scrollBeyondLastLine) =>
              updateSettings({ scrollBeyondLastLine })
            }
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="编辑">
        <SettingsRow label="缩进宽度">
          <SegmentedControl
            value={String(settings.tabSize)}
            options={EDITOR_TAB_SIZE_OPTIONS.map((size) => ({
              id: String(size),
              label: `${size}`,
            }))}
            onChange={(value) => updateSettings({ tabSize: Number(value) })}
          />
        </SettingsRow>

        <SettingsRow label="缩进方式" description="按 Tab 时插入空格而非制表符。">
          <SegmentedControl
            value={settings.insertSpaces ? "spaces" : "tabs"}
            options={[
              { id: "spaces", label: "空格" },
              { id: "tabs", label: "制表符" },
            ]}
            onChange={(value) => updateSettings({ insertSpaces: value === "spaces" })}
          />
        </SettingsRow>

        <SettingsRow label="自动换行">
          <Switch
            checked={settings.wordWrap}
            onCheckedChange={(wordWrap) => updateSettings({ wordWrap })}
          />
        </SettingsRow>

        <SettingsRow label="平滑滚动">
          <Switch
            checked={settings.smoothScrolling}
            onCheckedChange={(smoothScrolling) => updateSettings({ smoothScrolling })}
          />
        </SettingsRow>
      </SettingsGroup>
    </SettingsPage>
  );
}
