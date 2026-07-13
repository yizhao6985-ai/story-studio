import { useLocalStorageState, useMemoizedFn } from "ahooks";

const STORAGE_KEY = "storyStudio.contentLayoutSwapped";

export function useContentLayoutSwap() {
  const [contentLayoutSwapped, setContentLayoutSwapped] = useLocalStorageState(
    STORAGE_KEY,
    {
      defaultValue: false,
      deserializer: (raw) => raw === "1",
      serializer: (value) => (value ? "1" : "0"),
    },
  );

  const toggleContentLayout = useMemoizedFn(() => {
    setContentLayoutSwapped((prev) => !prev);
  });

  return {
    contentLayoutSwapped: contentLayoutSwapped ?? false,
    toggleContentLayout,
  };
}
