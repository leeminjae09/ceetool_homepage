import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { useState } from "react";
import { projectDetails } from "app/homepage-api";
import { useHomepageContent } from "hooks/useHomepageContent";
import DocumentationPage from "components/ProjectPage";
import ProjectDialog from "components/ProjectDialog";
import ServiceShowcase from "components/ServiceShowcase";
import BusinessInfo from "components/BusinessInfo";
import PolicyPage from "components/PolicyPage";
import {
  PaymentAdminPage,
  PaymentPage,
  PaymentResultPage,
} from "components/PaymentPages";

function Home() {
  const { content, error: contentError, retry } = useHomepageContent();
  const additionalProjects =
    content?.projects.filter((project) => project.archive) ?? [];
  const [selectedProject, setSelectedProject] = useState<{
    id: string;
    mediaSrc?: string;
  } | null>(null);

  function openProject(id: string, mediaSrc?: string) {
    setSelectedProject({ id, mediaSrc });
  }
  const selectedData = content?.projects.find(
    (project) => project.id === selectedProject?.id,
  );
  const selectedDetails = selectedData ? projectDetails(selectedData) : null;

  return (
    <main className="portfolio-home">
      <div className="mx-auto max-w-screen-xl">
        <header className="flex flex-wrap items-center justify-between gap-6 py-8 sm:py-12">
          <div>
            <p className="mb-2 text-[10px] font-semibold tracking-[0.2em] sm:text-xs">
              <span className="text-kakao/80">SOFTWARE</span>{" "}
              <span className="text-purple-200">DEVELOPER</span>
            </p>
            <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-white min-[375px]:text-4xl sm:text-5xl">
              <span
                aria-hidden="true"
                className="ceetool-brand-icon h-[1em] w-[1em] shrink-0"
              />
              <span>CEETOOL(씨툴)</span>
            </h1>
          </div>
          <nav
            aria-label="홈페이지 메뉴"
            className="flex flex-wrap items-center gap-2 sm:gap-5"
          >
            <a
              href="https://pf.kakao.com/_lDexan"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="카카오톡으로 문의하기: johnlee4 (새 창)"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-kakao px-4 py-3 text-sm font-bold text-black hover:bg-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kakao"
            >
              <img src="/logos/kakao-logo.png" alt="" className="w-5 h-5" />
              <span>카카오톡 문의</span>
            </a>
          </nav>
          <p className="basis-full break-keep text-base font-medium leading-relaxed text-gray-300 [overflow-wrap:anywhere] sm:text-lg">
            <span className="block">
              <strong className="font-semibold text-blue-500">15년 경력</strong>
              의 백엔드 개발자와 프론트엔드 팀이 함께합니다.
            </span>
            <span className="mt-1 block">
              쇼핑몰·거래소·은행 API 연동 경험을 바탕으로 웹부터 Android·iOS
              앱까지 개발합니다.
            </span>
          </p>
        </header>
        {contentError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-400/40 bg-gray-900 p-4 text-sm text-red-200"
          >
            <p>{contentError}</p>
            <button
              type="button"
              className="mt-2 min-h-11 text-blue-300 underline"
              onClick={retry}
            >
              다시 시도
            </button>
          </div>
        )}
        {!content && !contentError && (
          <p role="status" className="py-8 text-gray-400">
            홈페이지를 불러오는 중입니다.
          </p>
        )}
        {content && (
          <ServiceShowcase
            content={content}
            dialogOpen={selectedProject !== null}
            onProjectSelect={openProject}
          />
        )}
        <section aria-label="추가 수행 이력" className="pb-10">
          <details className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <summary className="cursor-pointer font-semibold text-gray-300 hover:text-white">
              추가 수행 이력 ({additionalProjects.length})
            </summary>
            <ul className="mt-4 grid gap-4 text-sm leading-relaxed text-gray-400 sm:grid-cols-2">
              {additionalProjects.map((project) => (
                <li key={project.name}>
                  <span className="font-medium text-gray-200">
                    {project.name}
                  </span>
                  <span className="mt-1 block">{project.description}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>
        <BusinessInfo className="space-y-1 border-t border-gray-800 py-8 text-center text-xs leading-relaxed text-gray-400" />
        {selectedProject && selectedDetails && (
          <ProjectDialog
            key={`${selectedProject.id}:${selectedProject.mediaSrc || ""}`}
            project={selectedDetails}
            initialMediaSrc={selectedProject.mediaSrc}
            onClose={() => setSelectedProject(null)}
          />
        )}
      </div>
    </main>
  );
}

function LegacyAdminRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: "/admin", search, hash }} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs/:docType" element={<DocumentationPage />} />
        <Route path="/privacy" element={<PolicyPage policy="privacy" />} />
        <Route path="/refund" element={<PolicyPage policy="refund" />} />
        <Route path="/pay/:token" element={<PaymentPage />} />
        <Route path="/pay/:token/result" element={<PaymentResultPage />} />
        <Route path="/admin" element={<PaymentAdminPage />} />
        <Route path="/admin/payments" element={<LegacyAdminRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
