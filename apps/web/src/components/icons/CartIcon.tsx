import type { SVGProps } from "react";

export function CartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M8.5 9V7.75C8.5 5.68 10.07 4 12 4s3.5 1.68 3.5 3.75V9" />
      <path d="M6.75 9h10.5c.9 0 1.59.8 1.46 1.69l-.68 4.89A3.3 3.3 0 0 1 14.76 19H9.24a3.3 3.3 0 0 1-3.27-2.82l-.68-4.89C5.16 9.8 5.85 9 6.75 9Z" />
    </svg>
  );
}
