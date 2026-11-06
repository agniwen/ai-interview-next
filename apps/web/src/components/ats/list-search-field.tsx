import { Input } from "@/components/ui/input";

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
