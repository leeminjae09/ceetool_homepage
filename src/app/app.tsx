import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import DocumentationPage from "components/ProjectPage";
import ProjectDialog from "components/ProjectDialog";
import Card from "components/organisms/card";
import { services } from "app/services";
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
        <p className="max-w-screen-lg text-lg sm:text-xl text-gray-300 font-medium mb-10 sm:mb-11 leading-relaxed">
          <span className="text-blue-500 font-bold">15년 경력</span>의 백엔드
          개발자와{" "}
          <span className="text-blue-500 font-bold">숙련된 프론트엔드 팀</span>
          이 결제연동·거래소·투자증권·금융·공공기관 프로젝트를{" "}
          <span className="text-blue-500 font-bold">전문적으로 수행</span>
          합니다. <span className="text-blue-500 font-bold">안정적인 운영</span>
          과 <span className="text-blue-500 font-bold">철저한 보안</span>,{" "}
          <span className="text-blue-500 font-bold">24시간 모니터링</span>으로
          신뢰할 수 있는{" "}
          <span className="text-blue-500 font-bold">맞춤형 솔루션</span>을
          제공합니다.
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
        {services.map(({ title, description, Icon, projects }) => (
          <Card
            key={title}
            title={title}
            description={description}
            Icon={Icon}
            projects={projects}
            onProjectSelect={setSelectedProject}
          />
        ))}
      </section>
      <BusinessInfo className="pb-16 max-w-screen-lg xl:max-w-screen-xl mx-auto text-center text-gray-400 font-bold text-sm leading-relaxed space-y-1" />
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
