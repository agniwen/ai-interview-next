import { Input } from "@/components/ui/input";

/**
 * 列表关键词输入框，将搜索变化交给列表路由维护 URL 状态。
 * List keyword input that delegates search changes to the list route's URL state.
 */
export function AtsListSearchField({
  value,
  placeholder,
  onSearch,
}: {
  value: string;
  placeholder: string;
  onSearch: (value: string) => void;
}) {
  return (
    <Input
      key={value}
      aria-label={placeholder}
      className="w-72 max-w-full"
      defaultValue={value}
      maxLength={200}
      onBlur={({ currentTarget }) => {
        const search = currentTarget.value.trim();
        currentTarget.value = search;
        if (search !== value) {
          onSearch(search);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
          event.currentTarget.blur();
        }
      }}
      placeholder={placeholder}
      type="search"
    />
  );
}
