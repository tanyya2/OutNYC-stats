import Image from "next/image";

// Same hosts as images.remotePatterns in next.config.ts. Users can edit their own
// avatar_url, and <Image> throws on any other host, so those get the letter instead.
const ALLOWED = [
  "https://stvkpfljyavatafrqcvv.supabase.co/storage/v1/object/public/",
  "https://lh3.googleusercontent.com/",
];

// Round profile photo, or the first letter of the name
export function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  if (url && ALLOWED.some((host) => url.startsWith(host))) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-paper font-serif text-ink-soft"
      style={{ width: size, height: size }}
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}
