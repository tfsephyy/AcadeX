<?php

namespace Database\Seeders;

use App\Models\Bookmark;
use App\Models\Capstone;
use App\Models\Keyword;
use App\Models\Role;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class CapstoneSeeder extends Seeder
{
    public function run(): void
    {
        $admin   = Role::firstOrCreate(['name' => 'admin']);
        $student = Role::firstOrCreate(['name' => 'student']);
        $faculty = Role::firstOrCreate(['name' => 'faculty']);

        // ── Admin user ──
        $adminUser = User::firstOrCreate(
            ['email' => 'eduadmin9@gmail.com'],
            [
                'name'              => 'System Administrator',
                'username'          => 'admin',
                'id_number'         => 'MBC2024-00001',
                'role_id'           => $admin->id,
                'password'          => Hash::make('Admin123'),
                'email_verified_at' => now(),
                'is_approved'       => true,
            ]
        );

        // ── Students ──
        $students = [];
        $studentData = [
            ['name' => 'Juan Dela Cruz',    'username' => 'juan.delacruz',    'id_number' => 'MBC2024-10001', 'email' => 'juan@student.edu',    'program' => 'BSIT', 'year' => '4', 'section' => 'A'],
            ['name' => 'Maria Santos',      'username' => 'maria.santos',     'id_number' => 'MBC2024-10002', 'email' => 'maria@student.edu',   'program' => 'BSIT', 'year' => '4', 'section' => 'B'],
            ['name' => 'Pedro Reyes',       'username' => 'pedro.reyes',      'id_number' => 'MBC2024-10003', 'email' => 'pedro@student.edu',   'program' => 'BSCpE','year' => '3', 'section' => 'A'],
            ['name' => 'Ana Garcia',        'username' => 'ana.garcia',       'id_number' => 'MBC2024-10004', 'email' => 'ana@student.edu',     'program' => 'BSIT', 'year' => '3', 'section' => 'A'],
            ['name' => 'Carlos Mendoza',    'username' => 'carlos.mendoza',   'id_number' => 'MBC2024-10005', 'email' => 'carlos@student.edu',  'program' => 'BSCpE','year' => '2', 'section' => 'B'],
            ['name' => 'Sophia Villanueva', 'username' => 'sophia.villanueva','id_number' => 'MBC2024-10006', 'email' => 'sophia@student.edu',  'program' => 'BSIT', 'year' => '2', 'section' => 'A'],
            ['name' => 'Miguel Torres',     'username' => 'miguel.torres',    'id_number' => 'MBC2024-10007', 'email' => 'miguel@student.edu',  'program' => 'BSCpE','year' => '1', 'section' => 'A'],
            ['name' => 'Isabella Cruz',     'username' => 'isabella.cruz',    'id_number' => 'MBC2024-10008', 'email' => 'isabella@student.edu', 'program' => 'BSIT', 'year' => '1', 'section' => 'B'],
        ];

        foreach ($studentData as $s) {
            $user = User::firstOrCreate(
                ['email' => $s['email']],
                [
                    'name'              => $s['name'],
                    'username'          => $s['username'],
                    'id_number'         => $s['id_number'],
                    'role_id'           => $student->id,
                    'password'          => Hash::make('password123'),
                    'email_verified_at' => now(),
                    'is_approved'       => true,
                ]
            );
            StudentProfile::firstOrCreate(
                ['user_id' => $user->id],
                ['program' => $s['program'], 'year' => $s['year'], 'section' => $s['section']]
            );
            $students[] = $user;
        }

        // ── Faculty ──
        $facultyData = [
            ['name' => 'Dr. Roberto Lim',    'username' => 'roberto.lim',    'id_number' => 'MBC2024-20001', 'email' => 'rlim@faculty.edu',    'faculty_program' => 'BSIT'],
            ['name' => 'Prof. Elena Ramos',   'username' => 'elena.ramos',   'id_number' => 'MBC2024-20002', 'email' => 'eramos@faculty.edu',  'faculty_program' => 'BSCpE'],
            ['name' => 'Dr. Antonio Bautista','username' => 'antonio.bautista','id_number'=> 'MBC2024-20003', 'email' => 'abautista@faculty.edu','faculty_program' => 'BSIT'],
        ];

        foreach ($facultyData as $f) {
            User::firstOrCreate(
                ['email' => $f['email']],
                [
                    'name'              => $f['name'],
                    'username'          => $f['username'],
                    'id_number'         => $f['id_number'],
                    'role_id'           => $faculty->id,
                    'password'          => Hash::make('password123'),
                    'email_verified_at' => now(),
                    'is_approved'       => true,
                    'faculty_program'   => $f['faculty_program'],
                ]
            );
        }

        // ── Keywords ──
        $keywordNames = [
            'machine learning', 'web development', 'mobile app', 'iot',
            'artificial intelligence', 'database', 'cloud computing', 'cybersecurity',
            'data analytics', 'blockchain', 'image processing', 'natural language processing',
            'automation', 'e-learning', 'healthcare', 'agriculture', 'inventory',
            'point of sale', 'attendance', 'scheduling',
        ];
        $keywords = [];
        foreach ($keywordNames as $name) {
            $keywords[$name] = Keyword::firstOrCreate(['name' => $name]);
        }

        // ── Dummy PDF path (placeholder) ──
        $dummyPdf = 'capstones/placeholder.pdf';

        // ── APPROVED Capstones (10) ──
        $approvedCapstones = [
            ['title' => 'Smart Campus Navigation System Using Indoor Positioning', 'author' => 'Juan Dela Cruz, Maria Santos', 'year' => 2025, 'program' => 'BSIT', 'category' => 'Mobile App', 'abstract' => 'A mobile application that provides real-time indoor navigation within campus buildings using BLE beacons and trilateration algorithms.', 'keywords' => ['mobile app', 'iot', 'automation']],
            ['title' => 'AI-Powered Student Performance Prediction Platform', 'author' => 'Pedro Reyes, Ana Garcia', 'year' => 2025, 'program' => 'BSIT', 'category' => 'AI/ML', 'abstract' => 'A web-based platform that uses machine learning models to predict student academic performance and provide early intervention recommendations.', 'keywords' => ['machine learning', 'artificial intelligence', 'data analytics']],
            ['title' => 'Blockchain-Based Document Verification System for Academic Records', 'author' => 'Carlos Mendoza, Sophia Villanueva', 'year' => 2024, 'program' => 'BSCpE', 'category' => 'Blockchain', 'abstract' => 'A decentralized application for verifying the authenticity of academic transcripts and certificates using blockchain technology.', 'keywords' => ['blockchain', 'cybersecurity', 'web development']],
            ['title' => 'IoT-Based Smart Greenhouse Monitoring and Control System', 'author' => 'Miguel Torres, Isabella Cruz', 'year' => 2024, 'program' => 'BSCpE', 'category' => 'IoT', 'abstract' => 'An automated greenhouse monitoring system using IoT sensors for temperature, humidity, and soil moisture with remote control capabilities.', 'keywords' => ['iot', 'automation', 'agriculture']],
            ['title' => 'Cloud-Based Inventory Management System for Small Businesses', 'author' => 'Juan Dela Cruz, Pedro Reyes', 'year' => 2024, 'program' => 'BSIT', 'category' => 'Web Application', 'abstract' => 'A scalable cloud-based inventory management solution designed for small to medium enterprises with real-time stock tracking.', 'keywords' => ['cloud computing', 'inventory', 'web development']],
            ['title' => 'Natural Language Processing Chatbot for University Inquiries', 'author' => 'Maria Santos, Ana Garcia', 'year' => 2023, 'program' => 'BSIT', 'category' => 'AI/ML', 'abstract' => 'An intelligent chatbot that handles common university inquiries using NLP techniques for intent classification and entity recognition.', 'keywords' => ['natural language processing', 'artificial intelligence', 'e-learning']],
            ['title' => 'Mobile-Based Health Monitoring App with Wearable Integration', 'author' => 'Carlos Mendoza, Miguel Torres', 'year' => 2023, 'program' => 'BSCpE', 'category' => 'Mobile App', 'abstract' => 'A health monitoring mobile application that integrates with wearable devices to track vital signs and provide health alerts.', 'keywords' => ['mobile app', 'iot', 'healthcare']],
            ['title' => 'Automated Class Scheduling System Using Genetic Algorithm', 'author' => 'Sophia Villanueva, Isabella Cruz', 'year' => 2023, 'program' => 'BSIT', 'category' => 'Automation', 'abstract' => 'An intelligent scheduling system that generates optimal class schedules using genetic algorithms considering room, faculty, and time constraints.', 'keywords' => ['automation', 'scheduling', 'artificial intelligence']],
            ['title' => 'Image-Based Plant Disease Detection Using Deep Learning', 'author' => 'Juan Dela Cruz, Carlos Mendoza', 'year' => 2022, 'program' => 'BSCpE', 'category' => 'AI/ML', 'abstract' => 'A mobile application that uses convolutional neural networks to identify plant diseases from leaf images with high accuracy.', 'keywords' => ['image processing', 'machine learning', 'agriculture']],
            ['title' => 'E-Learning Platform with Adaptive Content Delivery', 'author' => 'Ana Garcia, Sophia Villanueva', 'year' => 2022, 'program' => 'BSIT', 'category' => 'Web Application', 'abstract' => 'An adaptive e-learning platform that tailors content delivery based on student learning styles and performance analytics.', 'keywords' => ['e-learning', 'data analytics', 'web development']],
        ];

        $approvedIds = [];
        foreach ($approvedCapstones as $data) {
            $cap = Capstone::create([
                'title'             => $data['title'],
                'author'            => $data['author'],
                'year'              => $data['year'],
                'program'           => $data['program'],
                'category'          => $data['category'],
                'abstract'          => $data['abstract'],
                'pdf_path'          => $dummyPdf,
                'pdf_original_name' => str_replace(' ', '_', strtolower($data['title'])) . '.pdf',
                'is_published'      => true,
                'uploaded_by'       => $adminUser->id,
            ]);
            $kwIds = array_map(fn($k) => $keywords[$k]->id, $data['keywords']);
            $cap->keywords()->sync($kwIds);
            $approvedIds[] = $cap->id;
        }

        // ── PENDING Capstones (10) ──
        $pendingCapstones = [
            ['title' => 'QR Code-Based Attendance Tracking System', 'author' => 'Pedro Reyes, Maria Santos', 'year' => 2026, 'program' => 'BSIT', 'category' => 'Mobile App', 'abstract' => 'A contactless attendance tracking system using QR code scanning with GPS verification for classroom attendance management.', 'keywords' => ['mobile app', 'attendance', 'automation']],
            ['title' => 'Sentiment Analysis of Student Feedback Using NLP', 'author' => 'Ana Garcia, Juan Dela Cruz', 'year' => 2026, 'program' => 'BSIT', 'category' => 'AI/ML', 'abstract' => 'A system that analyzes student feedback and course evaluations using natural language processing to extract sentiment and key themes.', 'keywords' => ['natural language processing', 'data analytics', 'machine learning']],
            ['title' => 'Smart Parking Management System with Real-Time Availability', 'author' => 'Carlos Mendoza, Isabella Cruz', 'year' => 2026, 'program' => 'BSCpE', 'category' => 'IoT', 'abstract' => 'An IoT-based parking management system that provides real-time parking space availability using ultrasonic sensors and a mobile app.', 'keywords' => ['iot', 'mobile app', 'automation']],
            ['title' => 'Cybersecurity Awareness Training Platform with Gamification', 'author' => 'Miguel Torres, Sophia Villanueva', 'year' => 2026, 'program' => 'BSIT', 'category' => 'Web Application', 'abstract' => 'An interactive training platform that teaches cybersecurity concepts through gamified learning modules and simulated attack scenarios.', 'keywords' => ['cybersecurity', 'e-learning', 'web development']],
            ['title' => 'Augmented Reality Campus Tour Application', 'author' => 'Maria Santos, Pedro Reyes', 'year' => 2026, 'program' => 'BSCpE', 'category' => 'Mobile App', 'abstract' => 'A mobile AR application that provides interactive virtual tours of campus facilities with historical information overlays for prospective students.', 'keywords' => ['mobile app', 'image processing', 'e-learning']],
            ['title' => 'Automated Essay Grading System Using Machine Learning', 'author' => 'Juan Dela Cruz, Ana Garcia', 'year' => 2026, 'program' => 'BSIT', 'category' => 'AI/ML', 'abstract' => 'An automated grading system that evaluates student essays using NLP and ML models, providing instant feedback on grammar, coherence, and content relevance.', 'keywords' => ['machine learning', 'natural language processing', 'e-learning']],
            ['title' => 'Energy Consumption Monitoring Dashboard for Campus Buildings', 'author' => 'Isabella Cruz, Carlos Mendoza', 'year' => 2026, 'program' => 'BSCpE', 'category' => 'IoT', 'abstract' => 'A real-time dashboard for monitoring and analyzing energy consumption across campus buildings using IoT sensors and data visualization.', 'keywords' => ['iot', 'data analytics', 'cloud computing']],
            ['title' => 'Point of Sale System with Inventory Integration for Canteens', 'author' => 'Sophia Villanueva, Miguel Torres', 'year' => 2026, 'program' => 'BSIT', 'category' => 'Web Application', 'abstract' => 'A POS system integrated with inventory tracking and sales analytics for campus canteens and food outlets.', 'keywords' => ['point of sale', 'inventory', 'web development']],
            ['title' => 'Face Recognition Attendance System with Anti-Spoofing', 'author' => 'Pedro Reyes, Carlos Mendoza', 'year' => 2026, 'program' => 'BSCpE', 'category' => 'AI/ML', 'abstract' => 'A face recognition-based attendance system with liveness detection to prevent photo and video spoofing attacks.', 'keywords' => ['image processing', 'artificial intelligence', 'attendance']],
            ['title' => 'Student Mental Health Assessment Chatbot', 'author' => 'Ana Garcia, Maria Santos', 'year' => 2026, 'program' => 'BSIT', 'category' => 'AI/ML', 'abstract' => 'A conversational AI chatbot that screens for common mental health concerns among students and provides appropriate referrals to counseling services.', 'keywords' => ['artificial intelligence', 'natural language processing', 'healthcare']],
        ];

        foreach ($pendingCapstones as $data) {
            $cap = Capstone::create([
                'title'             => $data['title'],
                'author'            => $data['author'],
                'year'              => $data['year'],
                'program'           => $data['program'],
                'category'          => $data['category'],
                'abstract'          => $data['abstract'],
                'pdf_path'          => $dummyPdf,
                'pdf_original_name' => str_replace(' ', '_', strtolower($data['title'])) . '.pdf',
                'is_published'      => true,
                'uploaded_by'       => $adminUser->id,
            ]);
            $kwIds = array_map(fn($k) => $keywords[$k]->id, $data['keywords']);
            $cap->keywords()->sync($kwIds);
        }

        // ── Bookmarks (students bookmark some published capstones) ──
        $allCapstones = Capstone::limit(20)->get();
        foreach ($students as $i => $stu) {
            // Each student bookmarks 2-4 published capstones
            $capstonsToBookmark = $allCapstones->random(rand(2, min(4, $allCapstones->count())));
            foreach ($capstonsToBookmark as $capstone) {
                Bookmark::firstOrCreate(
                    ['user_id' => $stu->id, 'capstone_id' => $capstone->id],
                );
                Capstone::where('id', $capstone->id)->increment('bookmark_count');
            }
        }
    }
}
