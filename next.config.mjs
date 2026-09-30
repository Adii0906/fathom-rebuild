/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // LangChain/LangGraph use Node APIs; keep them out of the bundler.
  serverExternalPackages: ["@langchain/langgraph", "@langchain/groq", "@langchain/core"],
};
export default nextConfig;
