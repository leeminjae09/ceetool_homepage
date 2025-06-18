import { ComponentProps, forwardRef, useState } from "react";

interface Props extends ComponentProps<"div"> {
  text: string;
  className?: string;
  children?: React.ReactNode;
}

const CopyButton = forwardRef<HTMLDivElement, Props>(
  ({ text, className = "", children, ...rest }, ref) => {
    const [copied, setCopied] = useState(false);

    const onClick = () => {
      navigator.clipboard?.writeText(text).then(() => setCopied(true));
    };

    return (
      <div
        {...rest}
        ref={ref}
        role="button"
        className={`cursor-pointer transition-colors duration-200 ${className}`}
        onClick={onClick}
        title={copied ? "Copied!" : "Click to copy"}
      >
        {children ?? <span>{text}</span>}
      </div>
    );
  }
);

export default CopyButton;
