<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Most attendance tests aren't about the roster; the one that is turns it back on.
        config(['attendance.require_schedule' => false]);
    }
}
