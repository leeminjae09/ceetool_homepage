import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import DocumentationPage from "components/ProjectPage";
import ProjectDialog from "components/ProjectDialog";
import Card from "components/organisms/card";
import { additionalProjects, services } from "app/services";
import { portfolioProjects, type PortfolioProjectId } from "app/portfolio";
import BusinessInfo from "components/BusinessInfo";
import {
  PaymentAdminPage,
  PaymentPage,
  PaymentResultPage,
} from "components/PaymentPages";

function Home() {
  const [selectedProject, setSelectedProject] =
    useState<PortfolioProjectId | null>(null);

  return (
    <main>
      <header className="pt-16 z-10 relative max-w-screen-lg xl:max-w-screen-xl mx-auto">
        <p className="text-2xl sm:text-4xl leading-none font-bold tracking-tight text-white">
          <span className="inline-flex items-center gap-2">
            <span className="text-kakao opacity-75">SOFTWARE</span>
            <span className="text-purple-200 ml-1">DEVELOPER</span>
          </span>
        </p>
        <h1 className="text-6xl lg:text-7xl leading-none font-extrabold tracking-tight mb-8 sm:mb-10 text-purple-400">
          CEETOOL
        </h1>
        <p className="mb-4 text-2xl font-semibold leading-snug text-white sm:text-3xl">
          매출과 운영에 필요한 기능을 만듭니다.
        </p>
        <p className="max-w-screen-lg text-lg sm:text-xl text-gray-300 font-medium mb-10 sm:mb-11 leading-relaxed">
          <span className="text-blue-500 font-bold">15년 경력</span>의 백엔드
          개발자와{" "}
          <span className="text-blue-500 font-bold">숙련된 프론트엔드 팀</span>
          이 <span className="text-blue-500 font-bold">쇼핑몰·결제 시스템</span>
          을 중심으로 AI·마케팅 연동, 업무 자동화, 금융·공공기관 시스템을
          개발합니다.
        </p>
        <div className="absolute top-16 right-2 sm:top-12 sm:right-12 opacity-30 sm:opacity-50">
          <img
            src="/logos/ceetool.logo.png"
            alt="씨툴 CEETOOL 로고"
            width={1024}
            height={1024}
            className="w-20 h-20 sm:w-40 sm:h-40 object-contain"
          />
        </div>
      </header>
      <section
        aria-label="문의"
        className="max-w-screen-lg xl:max-w-screen-xl mx-auto my-6"
      >
        <div className="sm:flex items-center">
          <a
            href="https://pf.kakao.com/_lDexan"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="카카오톡으로 문의하기: johnlee4 (새 창)"
            className="bg-kakao text-black px-6 py-3 rounded-lg font-bold flex items-center space-x-3"
          >
            <img src="/logos/kakao-logo.png" alt="" className="w-5 h-5" />
            <span>johnlee4</span>
          </a>
        </div>
      </section>
      <section
        aria-label="개발 서비스 및 프로젝트"
        className="max-w-screen-lg xl:max-w-screen-xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {services.map((service) => (
          <Card
            key={service.title}
            {...service}
            onProjectSelect={setSelectedProject}
          />
        ))}
      </section>
      <section className="max-w-screen-lg xl:max-w-screen-xl mx-auto space-y-6">
        <details className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 sm:p-6">
          <summary className="cursor-pointer font-semibold text-gray-300 hover:text-white">
            블록체인 개발 이력 ({additionalProjects.length})
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
        <p className="text-center text-sm leading-relaxed text-gray-400">
          접근 권한·개인정보 보호·백업을 고려한 개발.
          <br />
          신규 구축뿐 아니라 기존 서비스의 기능 추가·오류 수정도 가능합니다.
        </p>
      </section>
      <BusinessInfo
        showAdminLink
        className="pb-16 max-w-screen-lg xl:max-w-screen-xl mx-auto text-center text-gray-400 font-bold text-sm leading-relaxed space-y-1"
      />
      {selectedProject && (
        <ProjectDialog
          key={selectedProject}
          project={portfolioProjects[selectedProject]}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs/:docType" element={<DocumentationPage />} />
        <Route path="/pay/:token" element={<PaymentPage />} />
        <Route path="/pay/:token/result" element={<PaymentResultPage />} />
        <Route path="/admin/payments" element={<PaymentAdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
