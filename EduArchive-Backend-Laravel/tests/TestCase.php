<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

$loader = require __DIR__ . '/../vendor/autoload.php';
$worktreeApp = realpath(__DIR__ . '/../app');
if ($worktreeApp) {
    $classMap = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($worktreeApp));
    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $path = $file->getRealPath();
            $relativePath = substr($path, strlen($worktreeApp) + 1);
            $class = 'App\\' . str_replace(['/', '\\', '.php'], ['\\', '\\', ''], $relativePath);
            $classMap[$class] = $path;
        }
    }
    $loader->addClassMap($classMap);
}
$loader->setPsr4('App\\', [__DIR__ . '/../app']);
$loader->setPsr4('Tests\\', [__DIR__]);

abstract class TestCase extends BaseTestCase
{
    public function createApplication()
    {
        $app = require __DIR__ . '/../bootstrap/app.php';
        $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
        return $app;
    }
}
