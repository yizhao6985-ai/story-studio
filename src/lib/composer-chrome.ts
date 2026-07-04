/** 输入框内文字、tag、按钮统一 13px */
export const COMPOSER_TEXT_CLASS = "text-[13px]";

/** tag、发送按钮等控件统一高度 */
export const COMPOSER_CONTROL_HEIGHT_CLASS = "h-7";

/** 对话区 textarea：行高 20px + 上下各 4px 内边距 = 28px，文字垂直居中 */
export const COMPOSER_TEXTAREA_CLASS = `${COMPOSER_TEXT_CLASS} min-h-7 py-1 leading-5`;

export const COMPOSER_TAG_BUTTON_CLASS = `${COMPOSER_CONTROL_HEIGHT_CLASS} inline-flex cursor-pointer items-center gap-0.5 rounded-none border px-1.5 ${COMPOSER_TEXT_CLASS} leading-none font-medium transition-colors`;
