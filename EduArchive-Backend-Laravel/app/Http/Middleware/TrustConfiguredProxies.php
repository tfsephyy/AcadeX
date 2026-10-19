<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\IpUtils;

class TrustConfiguredProxies extends TrustProxies
{
    protected $headers = Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_PROTO | Request::HEADER_X_FORWARDED_PORT;

    protected function setTrustedProxyIpAddresses(Request $request)
    {
        $addresses = config('acadex.trusted_proxies', []);
        foreach ($addresses as $address) {
            $ip = explode('/', $address)[0];
            if (!filter_var($ip, FILTER_VALIDATE_IP)) {
                throw new \RuntimeException('TRUSTED_PROXIES must contain explicit IP addresses or CIDRs.');
            }
            // Validate the optional subnet mask as well. No wildcard/REMOTE_ADDR trust.
            if (!IpUtils::checkIp($ip, $address) || str_ends_with($address, '/0')) {
                throw new \RuntimeException('TRUSTED_PROXIES contains an invalid or unrestricted network.');
            }
        }
        $request::setTrustedProxies($addresses, $this->headers);
    }
}
