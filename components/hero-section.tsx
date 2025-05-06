'use client';

import { Button } from "@/components/ui/button";
import { ArrowRight, PlayCircle, TrendingUp, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import CountUp from "react-countup";
import { cn } from "@/lib/utils";

export function HeroSection() {
  // Define animations
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };
  
  const staggerContainer = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.2
      }
    }
  };
  
  const slideIn = {
    hidden: { opacity: 0, x: 30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const features = [
    { title: "Course Creation", description: "Intuitive tools" },
    { title: "Live Streaming", description: "Engage in real-time" },
    { title: "Analytics", description: "Track your growth" }
  ];

  return (
    <section className="relative pt-16 pb-32 px-4 md:px-6 overflow-hidden bg-gradient-to-b from-slate-950 via-[#0f172a] to-indigo-950">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-30 pointer-events-none">
          {/* Gradient Orbs */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ duration: 2 }}
            className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-r from-violet-800/40 via-indigo-800/40 to-indigo-900/40 blur-3xl"
          ></motion.div>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ duration: 2, delay: 0.5 }}
            className="absolute top-[30%] -right-[5%] w-[40%] h-[40%] rounded-full bg-gradient-to-r from-purple-800/30 via-violet-800/30 to-fuchsia-800/30 blur-3xl"
          ></motion.div>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 2, delay: 1 }}
            className="absolute -bottom-[10%] left-[10%] w-[45%] h-[45%] rounded-full bg-gradient-to-tr from-blue-900/30 via-indigo-900/30 to-purple-900/30 blur-3xl"
          ></motion.div>
          
          {/* Grain texture overlay */}
          <div className="absolute inset-0 opacity-20" style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
          }}></div>
          
          {/* Grid overlay */}
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] bg-[length:50px_50px] opacity-[0.015]"></div>
          
          {/* Animated particle elements */}
          {[...Array(15)].map((_, i) => (
            <motion.div 
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                opacity: 0.2 + Math.random() * 0.5
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.3, 0.8, 0.3]
              }}
              transition={{
                duration: 4 + Math.random() * 6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: Math.random() * 5
              }}
            ></motion.div>
          ))}
        </div>
      </div>

      <div className="container mx-auto max-w-7xl relative z-10">
        {/* Header and Image in the First Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-12">
          {/* Left Content Column */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex flex-col gap-6 max-w-xl"
          >
            <motion.div variants={fadeInUp} className="badge-pulse inline-flex items-center px-5 py-2 rounded-full bg-indigo-950/70 border border-indigo-700/40 text-indigo-200 text-sm font-medium mb-2 w-fit">
              <div className="pulse mr-3">
                <div className="dot"></div>
              </div>
              The Future of Learning is Here
            </motion.div>

            <motion.h1 variants={fadeInUp} className="text-4xl md:text-5xl xl:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Learn Anything,
              <br />
              <span>Teach <span className="text-purple-400">Without</span> <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Limits</span></span>
            </motion.h1>

            <motion.p variants={fadeInUp} className="text-xl text-slate-300/90 leading-relaxed font-light">
              Create, manage, and share your knowledge with zero technical hassle. Our platform integrates seamlessly with YouTube, giving you powerful tools to build your audience and transform education.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 mt-2">
              <Button 
                asChild 
                size="lg" 
                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 rounded-xl px-8 btn-3d"
              >
                <Link href="/auth/signup">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-slate-700 text-slate-200 hover:bg-slate-800/50 gap-2 rounded-xl"
              >
                <Link href="/#demo-video">
                  <PlayCircle className="h-5 w-5" /> See How It Works
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Right Content Column - Platform Preview */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={slideIn}
            className="relative mt-2"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative rounded-2xl overflow-hidden shadow-[0_20px_80px_-20px_rgba(66,71,112,0.3)] border border-slate-700/50"
            >
              {/* Using the actual dashboard image */}
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl">
                <Image 
                  src="/images/dashboard-preview-1.png" 
                  alt="Educational platform dashboard"
                  width={1280}
                  height={720}
                  className="w-full h-full object-cover"
                  priority
                />
                {/* Glowing overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                <div className="absolute inset-0 rounded-2xl ring-1 ring-indigo-500/30 shadow-[inset_0_0_20px_rgba(79,70,229,0.2)]"></div>
              </div>
              
              {/* Floating elements */}
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.9, rotate: 0 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: 6 }}
                transition={{ duration: 0.5, delay: 1.2 }}
                className="absolute -right-6 top-1/4 bg-white/5 dark:bg-slate-800/20 rounded-xl p-3 shadow-xl backdrop-blur-md border border-white/10 dark:border-slate-700/50 glow-blue"
              >
                <div className="flex items-center gap-2">
                  <div className="bg-green-500 rounded-full h-3 w-3 animate-pulse"></div>
                  <div className="text-sm font-medium text-white flex items-center gap-1.5">
                    <span>Live class</span>
                    <Sparkles className="h-3 w-3 text-yellow-400" />
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9, rotate: 0 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: -6 }}
                transition={{ duration: 0.5, delay: 1.4 }}
                className="absolute left-8 -bottom-5 bg-white/5 dark:bg-slate-800/20 rounded-xl p-3 shadow-xl backdrop-blur-md border border-white/10 dark:border-slate-700/50 glow-purple"
              >
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-xs text-white font-medium">+</div>
                  </div>
                  <div className="text-xs font-medium text-white">Engagement up 43%</div>
                </div>
              </motion.div>
            </motion.div>
            
            {/* Stats card */}
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.6 }}
              className="absolute -bottom-10 -left-10 bg-white/5 dark:bg-slate-800/20 rounded-xl p-4 shadow-xl backdrop-blur-md border border-white/10 dark:border-slate-700/30 max-w-[200px] glow-teal"
            >
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-indigo-900/40 to-cyan-900/40 p-2 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-indigo-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-300">Monthly Growth</div>
                  <div className="text-xl font-bold text-white">
                    <CountUp end={127} duration={2} delay={0.2} />%
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Decorative elements */}
            <div className="absolute -z-10 top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-gradient-to-r from-purple-600/20 to-indigo-600/20 blur-3xl"></div>
            <div className="absolute -z-10 bottom-0 left-1/3 transform -translate-x-1/2 translate-y-1/4 w-48 h-48 rounded-full bg-gradient-to-r from-indigo-600/20 to-blue-600/20 blur-3xl"></div>
          </motion.div>
        </div>

        {/* Features Section (Below Hero) */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mt-16 md:mt-12"
        >
          <motion.div 
            variants={fadeInUp}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/60 rounded-xl p-6 transition-all hover:border-indigo-700/40 hover:bg-slate-800/40"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-950 border border-indigo-800/40">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  </div>
                  <p className="text-slate-400 pl-14">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
        
        {/* User Section (Below Features) */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mt-16 flex flex-col md:flex-row items-center justify-center gap-6 py-8 px-8 rounded-xl bg-slate-900/40 border border-slate-800/60"
        >
          <motion.div variants={fadeInUp} className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {[1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  className="w-12 h-12 rounded-full border-2 border-slate-900 overflow-hidden ring-2 ring-indigo-600/20"
                >
                  <Image 
                    src="/placeholder-user.jpg" 
                    alt="Successful teacher"
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            <p className="text-md md:text-lg text-slate-300">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 font-semibold">
                <CountUp end={1000} duration={2.5} separator="," />+
              </span> creators joined in the last month
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
