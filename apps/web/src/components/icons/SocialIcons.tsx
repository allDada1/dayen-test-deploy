type SocialIconProps = {
  className?: string;
};

export function TelegramIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M21.8 4.4 18.6 19c-.2 1-.8 1.2-1.6.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.9 8.8-8c.4-.4-.1-.5-.6-.2L6.4 12.8l-4.7-1.5c-1-.3-1-1 .2-1.5l18.3-7.1c.9-.3 1.8.2 1.6 1.7Z"
      />
    </svg>
  );
}

export function InstagramIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="16" height="16" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="16.8" cy="7.2" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function TikTokIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M14.1 3h2.5c.3 2.2 1.7 3.7 4 4v2.6c-1.5 0-3.1-.5-4.1-1.4v6.4A5.4 5.4 0 1 1 11.1 9c.4 0 .8 0 1.2.1v2.8a2.5 2.5 0 0 0-1.2-.3 2.8 2.8 0 1 0 2.8 2.8V3Z"
      />
    </svg>
  );
}

export function YoutubeIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M21.5 7.2a3.1 3.1 0 0 0-.5-1.4 2.2 2.2 0 0 0-1.4-.6C17.8 5 12 5 12 5s-5.8 0-7.6.2a2.2 2.2 0 0 0-1.4.6 3.1 3.1 0 0 0-.5 1.4 32 32 0 0 0 0 9.6 3.1 3.1 0 0 0 .5 1.4c.4.4.9.6 1.4.6 1.8.2 7.6.2 7.6.2s5.8 0 7.6-.2c.5 0 1-.2 1.4-.6a3.1 3.1 0 0 0 .5-1.4 32 32 0 0 0 0-9.6ZM10 15.4V8.6l5.5 3.4-5.5 3.4Z"
      />
    </svg>
  );
}

export function WhatsAppIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12.1 3a8.7 8.7 0 0 0-7.5 13.2L3.4 21l4.9-1.2A8.7 8.7 0 1 0 12.1 3Zm0 2a6.7 6.7 0 1 1-3.2 12.6l-.4-.2-2.4.6.6-2.3-.3-.4A6.7 6.7 0 0 1 12.1 5Zm-2.5 3.5c-.2 0-.5.1-.7.4-.2.3-.8.8-.8 1.9 0 1.1.8 2.1.9 2.2.1.2 1.6 2.6 4 3.5 2 .8 2.4.6 2.8.6.4 0 1.3-.5 1.5-1 .2-.5.2-.9.1-1-.1-.1-.2-.2-.5-.3l-1.5-.7c-.2-.1-.4-.1-.6.2l-.7.8c-.1.2-.3.2-.6.1-.3-.1-1.1-.4-2-1.2-.8-.7-1.3-1.5-1.4-1.7-.1-.3 0-.4.1-.6l.4-.4c.1-.1.2-.3.3-.4.1-.2.1-.3 0-.5l-.7-1.6c-.2-.3-.3-.3-.6-.3Z"
      />
    </svg>
  );
}

export function ChatSocialIcon({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M5.5 18.2 4 21l3.5-.9A8 8 0 1 0 4 13.5c0 1.8.6 3.4 1.5 4.7Z"
      />
      <path fill="currentColor" d="M8.2 12.2a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm3.8 0a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm3.8 0a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Z" />
    </svg>
  );
}
