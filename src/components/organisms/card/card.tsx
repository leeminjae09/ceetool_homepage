import { forwardRef, type ComponentProps } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { portfolioProjects, type PortfolioProjectId } from "app/portfolio";
import type { Service } from "app/services";

export interface CardProps
  extends Omit<ComponentProps<"div">, "className" | "children"> {
  title: string;
  description: string;
  Icon: Service["Icon"];
  projects: Service["projects"];
  onProjectSelect: (id: PortfolioProjectId) => void;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ title, description, Icon, projects, onProjectSelect, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-gray-800 border border-gray-700 p-6 rounded-lg text-white flex flex-col gap-3"
        {...rest}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-blue-400">{title}</h2>
          <Icon className="w-8 h-8 shrink-0 text-gray-400" aria-hidden="true" />
        </div>
        <p className="text-sm leading-relaxed text-gray-300">{description}</p>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-gray-400 space-y-2">
          {projects.map((project) => (
            <li key={project.name}>
              {project.portfolioId ? (
                <>
                  <button
                    type="button"
                    aria-label={`${project.name} 포트폴리오 보기`}
                    aria-haspopup="dialog"
                    onClick={() =>
                      project.portfolioId &&
                      onProjectSelect(project.portfolioId)
                    }
                    className="rounded text-left font-semibold text-blue-300 underline decoration-blue-400/60 underline-offset-4 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                  >
                    {project.name}
                  </button>
                  <a
                    href={portfolioProjects[project.portfolioId].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${project.name} 사이트 방문 (새 창)`}
                    className="ml-1 inline-flex min-h-8 min-w-8 items-center justify-center rounded align-middle text-blue-300 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                  >
                    <ArrowTopRightOnSquareIcon
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </a>
                </>
              ) : (
                project.name
              )}
              <span> – {project.description}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  },
);

export default Card;
