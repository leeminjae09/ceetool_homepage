import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Link, useParams } from "react-router-dom";
import { projectDetails } from "app/homepage-api";
import { useHomepageContent } from "hooks/useHomepageContent";
import ProjectDetails from "./organisms/project-details/project-details";

export default function DocumentationPage() {
  const { docType } = useParams<{ docType: string }>();
  const { content, error, retry } = useHomepageContent();
  const document = content?.documents.find(
    (document) => document.id === docType,
  );
  const projects =
    document?.projectIds.flatMap((id) => {
      const project = content?.projects.find((project) => project.id === id);
      return project ? [project] : [];
    }) ?? [];
  return (
    <main>
      <div className="mx-auto max-w-screen-xl px-4 pb-16">
        <nav
          aria-label="페이지 이동"
          className="sticky top-0 z-20 bg-gray-900/95 py-5 backdrop-blur"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded font-semibold text-white hover:text-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
          >
            <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
            홈으로 돌아가기
          </Link>
        </nav>
        {error ? (
          <div role="alert" className="space-y-3 py-8 text-red-200">
            <p>{error}</p>
            <button
              type="button"
              className="min-h-11 text-blue-300 underline"
              onClick={retry}
            >
              다시 시도
            </button>
          </div>
        ) : !content ? (
          <p role="status" className="py-8 text-gray-300">
            프로젝트를 불러오는 중입니다.
          </p>
        ) : !document ? (
          <h1 className="py-16 text-3xl font-bold text-white">
            페이지를 찾을 수 없습니다.
          </h1>
        ) : (
          <>
            <header className="space-y-4 pb-10 pt-6">
              <p className="text-sm font-semibold tracking-widest text-purple-300">
                CEETOOL PROJECTS
              </p>
              <h1 className="text-3xl font-extrabold text-white sm:text-5xl">
                {document.title}
              </h1>
              <p className="text-lg leading-relaxed text-blue-300">
                {document.description}
              </p>
              <p className="max-w-3xl whitespace-pre-line leading-relaxed text-gray-300">
                {document.details}
              </p>
            </header>
            <section
              aria-labelledby="project-history-heading"
              className="rounded-xl border border-gray-700 bg-gray-800 p-5 sm:p-8"
            >
              <h2
                id="project-history-heading"
                className="text-xl font-bold text-white"
              >
                주요 수행 이력
              </h2>
              <ul className="mt-4 list-disc space-y-3 pl-5 leading-relaxed text-gray-300">
                {projects.map((project) => (
                  <li key={project.id}>
                    {project.name} – {project.description}
                  </li>
                ))}
              </ul>
            </section>
            <div className="mt-10 space-y-10">
              {projects.map((project) => {
                const details = projectDetails(project);
                return details ? (
                  <ProjectDetails key={project.id} {...details} />
                ) : null;
              })}
            </div>
            <section className="mt-10 rounded-xl border border-gray-700 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white">프로젝트 문의</h2>
              <p className="mt-3 leading-relaxed text-gray-300">
                필요한 기능과 현재 운영 환경을 알려주시면 개발 범위를 함께
                검토하겠습니다.
              </p>
              <a
                href="mailto:john@ceetool.com"
                className="mt-4 inline-block rounded font-semibold text-blue-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
              >
                john@ceetool.com
              </a>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
