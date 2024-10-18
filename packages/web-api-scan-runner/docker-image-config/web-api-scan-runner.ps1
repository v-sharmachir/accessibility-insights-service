# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

param ($nodeargs = '')

Write-Host "Adding network route for Azure Instance Metadata Service endpoint..."
$gateway = (Get-NetRoute '0.0.0.0/0').NextHop
$arguments = 'add', '169.254.169.0', 'mask', '255.255.255.0', $gateway
route $arguments | Out-Null

node $nodeargs --max-old-space-size=8192 ./web-api-scan-runner.js
