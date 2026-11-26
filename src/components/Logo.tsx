import Link from "next/link";

export default function Logo({
  size = 36,
  withWordmark = true,
}: {
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <img
        src="/logo.svg"
        alt="SocialX logo"
        width={size}
        height={size}
        className="rounded-lg"
      />
      {withWordmark && (
        <span className="text-[22px] font-extrabold tracking-tight leading-none">
          SocialX
        </span>
      )}
    </Link>
  );
}