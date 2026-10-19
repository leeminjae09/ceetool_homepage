import {
  forwardRef,
  ComponentProps,
  RefAttributes,
  ForwardRefExoticComponent,
  SVGProps,
} from "react";
import { Link } from "react-router-dom";

export interface CardProps
  extends Omit<ComponentProps<"div">, "className" | "children"> {
  title: string;
  description: string;
  Icon: ForwardRefExoticComponent<
    Omit<SVGProps<SVGSVGElement>, "ref"> & {
      title?: string | undefined;
      titleId?: string | undefined;
    } & RefAttributes<SVGSVGElement>
  >;
  projects: readonly string[];
  href: string;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ title, description, Icon, projects, href, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-gray-800 border border-gray-700 p-6 rounded-lg text-white flex flex-col gap-3 min-h-[280px]"
        {...rest}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-blue-400">{title}</h2>
          <Icon className="w-8 h-8 shrink-0 text-gray-400" aria-hidden="true" />
        </div>
        <p className="text-sm leading-relaxed text-gray-300">{description}</p>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-gray-400 space-y-1">
          {projects.map((project) => (
            <li key={project}>{project}</li>
          ))}
        </ul>
        <div className="mt-auto pt-3">
          <Link
            to={href}
            className="text-sm font-bold text-white hover:underline"
          >
            프로젝트 자세히 보기 →
          </Link>
        </div>
      </div>
    );
  }
);

export default Card;
