function processImage(imagePath, dataFilePath)
% 임의 원점의 WGS84 좌표
% MATLAB 경고 메시지 비활성화
warning('off', 'all');

origin_lat = 37.5830377627392; % 임의 원점의 위도
origin_lon = 127.05833550542593; % 임의 원점의 경도
% 작업 디렉토리 변경
oldDir = cd(dataFilePath); % 이전 디렉토리 저장

baseUploadDir = 'D:\pos\test\my-backend';
imagePath = fullfile(baseUploadDir, imagePath); % 풀 경로 생성

% YOLO 모델 로드
load('YOLO_AGUMENT.mat');
% 카메라 calibration 파라미터 불러오기
load('cm.mat');
cameraParams =cm_calibration;
% 유효한 숫자 목록
validNumbers = {'601', '602', '603', '605', '606', '607', '608', '611'};

option = 0;
% 결과를 저장할 배열 초기화
all_final_results = [];
final_result = [];
final_result2 = [];
final = [];
all_correction_result = [];
% 유효한 숫자 목록
ocr_door = 'xxx';
ocr_board = 'xxx';

% 이미지 읽기
targetImage = imread(imagePath);
targetImage = imrotate(targetImage, -90);
% YOLO 객체 검출 수행
[bboxes, scores, labels] = detect(detector, targetImage, Threshold=0.1);

% 모든 검출된 객체에 대해 반복 처리
for i = 1:size(bboxes, 1)
    % 바운딩 박스 추출 및 label 확인
    bbox = bboxes(i, :);  % 각 객체의 바운딩 박스
    label = labels(i);    % 객체의 라벨 추출 ('door' 또는 'board')

    if strcmp(string(label), "door")  % label이 'door'인 경우에만 실행
        for attempt = 1:4
            % 이미지에서 객체 잘라내기 (cropping)
            croppedObject = imcrop(targetImage, bbox);
            grayImage = rgb2gray(croppedObject);  % 그레이스케일로 변환



            % 바이너리 이미지로 변환
            if attempt == 1
                % 가우시안 필터 적용
                filteredImage = imgaussfilt(grayImage, 1.2);
                binaryImage = imbinarize(filteredImage, 0.5);
                ws =0.07; rt = 0.05;
                wh =0.25; ct = 0.05;
            elseif attempt == 2
                filteredImage = imgaussfilt(grayImage, 1.2);
                binaryImage = imbinarize(filteredImage, 0.3);  % 다른 임계값 사용
                ws =0.07; rt = 0.05;
                wh =0.25; ct = 0.05;
            elseif attempt == 3
                filteredImage = imgaussfilt(grayImage, 1.1);
                binaryImage = imbinarize(filteredImage, 0.6);
                ws =0.06; rt = 0.15;
                wh =0.25; ct = 0.15;
            elseif attempt == 4
                filteredImage = imgaussfilt(grayImage, 1.2);
                binaryImage = imbinarize(filteredImage, 0.45);
                ws =0.06; rt = 0.15;
                wh =0.25; ct = 0.15;
            end

            % Morphological 연산으로 잡음 제거 (열림 연산)
            se = strel('disk', 2);
            binaryImage = imopen(binaryImage, se);

            % 이미지 크기 계산
            [rows, cols] = size(binaryImage);

            % 가장자리 제거 (상하좌우 5%씩)
            rowTrim = floor(rt * rows);
            colTrim = floor(ct * cols);
            croppedImage = binaryImage(rowTrim:end-rowTrim, colTrim:end-colTrim);

            % 윈도우 탐색 및 흰색이 가장 많은 부분 추출
            windowHeight = floor(ws * size(croppedImage, 1));
            windowWidth = floor(wh * size(croppedImage, 2));

            bestScore = 0;
            bestWindow = [];
            bestPosition = [1, 1];  % 초기값 설정

            for r = 1:10:size(croppedImage, 1) - windowHeight + 1
                for c = 1:10:size(croppedImage, 2) - windowWidth + 1
                    window = croppedImage(r:r+windowHeight-1, c:c+windowWidth-1);

                    % 흰색 픽셀 개수 계산
                    score = sum(window(:));

                    % 흰색 픽셀의 분산 계산 (위치의 분산)
                    [whiteRows, whiteCols] = find(window);
                    if ~isempty(whiteRows)
                        rowVar = var(whiteRows);
                        colVar = var(whiteCols);
                        spatialVariance = rowVar + colVar;
                    else
                        spatialVariance = 0;
                    end

                    % 지역적 밀도 계산
                    numRows = size(window, 1);
                    numCols = size(window, 2);
                    rowStep1 = floor(numRows / 3);
                    colStep1 = floor(numCols / 1);

                    rowStep2 = floor(numRows / 1);
                    colStep2 = floor(numCols / 2);
                    maxBlockDensity1 = 0;
                    maxBlockDensity2 = 0;
                    % 각 블록의 밀도 계산
                    for row = 1:rowStep1:numRows-rowStep1+1
                        for col = 1:colStep1:numCols-colStep1+1
                            block = window(row:row+rowStep1-1, col:col+colStep1-1);
                            blockDensity = sum(block(:)) / numel(block);
                            maxBlockDensity1 = max(blockDensity);
                            minBlockDensity1 = min(blockDensity);

                        end
                    end

                    for row = 1:rowStep2:numRows-rowStep2+1
                        for col = 1:colStep2:numCols-colStep2+1
                            block = window(row:row+rowStep2-1, col:col+colStep2-1);
                            blockDensity = sum(block(:)) / numel(block);
                            maxBlockDensity2 = max(blockDensity);
                            minBlockDensity2 = min(blockDensity);

                        end
                    end

                    % 특정 조건에 맞는 경우만 선택
                    if score > bestScore && maxBlockDensity1 < 0.4 && maxBlockDensity2 < 0.4 && sum(sum(window(:, 1))) < 100  && sum(sum(window(:, end-20:end))) < 20 && minBlockDensity1 > 0.1 && minBlockDensity2 > 0.1
                        bestScore = score;
                        bestWindow = window;
                        bestPosition = [r, c];  % 윈도우 위치 저장
                    end
                end
            end

            % OCR 수행 및 결과 확인 (bestWindow가 유효한 경우에만 진행)
            if ~isempty(bestWindow)
                % 잡티 제거 (작은 객체 제거)
                cleanedWindow = bwareaopen(bestWindow, 500); % 500 픽셀 이하의 객체 제거

                % 중심 이동: 흰색 영역을 중앙으로 배치
                [rowIdx, colIdx] = find(cleanedWindow == 1);
                if ~isempty(rowIdx)
                    minRow = min(rowIdx); maxRow = max(rowIdx);
                    minCol = min(colIdx); maxCol = max(colIdx);
                    numberRegion = cleanedWindow(minRow:maxRow, minCol:maxCol);
                    centeredWindow = zeros(size(cleanedWindow));

                    % 중앙으로 배치
                    [centeredRows, centeredCols] = size(centeredWindow);
                    numRowsRegion = size(numberRegion, 1);
                    numColsRegion = size(numberRegion, 2);

                    rowStart = floor((centeredRows - numRowsRegion) / 2);
                    colStart = floor((centeredCols - numColsRegion) / 2);

                    centeredWindow(rowStart+1:rowStart+numRowsRegion, colStart+1:colStart+numColsRegion) = numberRegion;
                else
                    centeredWindow = cleanedWindow; % 흰색 영역이 없으면 그대로 사용
                end

                % OCR 수행 (중앙 이동된 이미지)
                ocrResultsCentered = ocr(centeredWindow, 'CharacterSet', '0123456789');
                recognizedTextCentered = strtrim(ocrResultsCentered.Text);  % 공백 제거

                % 실제 이미지에서의 윈도우 위치 계산
                windowInOriginal = [bbox(1) + colTrim + bestPosition(2), bbox(2) + rowTrim + bestPosition(1), windowWidth, windowHeight];

                % OCR 수행 (원본 이미지에서 잘린 부분)
                Originalcropped = imcrop(targetImage, windowInOriginal);
                % figure
                % imshow(Originalcropped)
                ocrResultsOriginal = ocr(Originalcropped, 'CharacterSet', '0123456789');
                recognizedTextOriginal = strtrim(ocrResultsOriginal.Text);  % 공백 제거
                if ismember(recognizedTextOriginal,validNumbers)
                    ocr_door = recognizedTextOriginal;
                    door_gray = grayImage;

                    pointsTarget = detectSURFFeatures(door_gray,'MetricThreshold', 100);

                    [featuresTarget_door, validPointsTarget_door] = extractFeatures(door_gray,pointsTarget);
                    imagebox_door = validPointsTarget_door.Location;

                    validPointsTarget_door.Location(:,1) = validPointsTarget_door.Location(:,1) + bbox(1);
                    validPointsTarget_door.Location(:,2) = validPointsTarget_door.Location(:,2) + bbox(2);
                    break;
                end
                % OCR 수행 (잡티 제거 후)
                ocrResultsCleaned = ocr(cleanedWindow, 'CharacterSet', '0123456789');
                recognizedTextCleaned = strtrim(ocrResultsCleaned.Text);  % 공백 제거

                if ismember(recognizedTextCleaned,validNumbers)
                    ocr_door = recognizedTextCleaned;
                    door_gray = grayImage;
                    pointsTarget = detectSURFFeatures(door_gray,'MetricThreshold', 100);

                    [featuresTarget_door, validPointsTarget_door] = extractFeatures(door_gray,pointsTarget);
                    imagebox_door = validPointsTarget_door.Location;

                    validPointsTarget_door.Location(:,1) = validPointsTarget_door.Location(:,1) + bbox(1);
                    validPointsTarget_door.Location(:,2) = validPointsTarget_door.Location(:,2) + bbox(2);

                    break;
                end
            end
        end
    elseif strcmp(string(label),'board')
        croppedObject = imcrop(targetImage, bbox);
        % 이미지 크기 계산
        [height, ~] = size(croppedObject);

        % 위쪽 절반만 남기기
        croppedUpperHalf = croppedObject(1:round(height/2), :,:);
        % 원본 자른 이미지에서 바로 OCR 수행
        ocrResultsBoardOriginal = ocr(croppedUpperHalf, 'CharacterSet', '0123456789');
        recognizedTextBoardOriginal = strtrim(ocrResultsBoardOriginal.Text);  % 공백 제거
        croppedUpperHalf = imresize(croppedUpperHalf,2);
        % 바이너리 변환된 이미지에서 OCR 수행
        grayImage = rgb2gray(croppedUpperHalf);  % 그레이스케일로 변환
        binaryImage = imbinarize(imgaussfilt(grayImage, 1.2), 0.5);  % 이진화
        % 잡티 제거 (작은 객체 제거)
        cleanedWindow = bwareaopen(binaryImage, 100); % 500 픽셀 이하의 객체 제거

        ocrResultsBoardBinary = ocr(cleanedWindow, 'CharacterSet', '0123456789');
        recognizedTextBoardBinary = strtrim(ocrResultsBoardBinary.Text);  % 공백 제거

        % 유효한 숫자 확인
        if ismember(recognizedTextBoardOriginal, validNumbers)
            ocr_board = recognizedTextBoardOriginal;
            board_gray = grayImage;
            pointsTarget = detectSURFFeatures(board_gray,'MetricThreshold', 100);
            [h_target, w_target, ~] = size(board_gray);

            [featuresTarget_board, validPointsTarget_board] = extractFeatures(board_gray,pointsTarget);
            imagebox_board = validPointsTarget_board.Location;

            validPointsTarget_board.Location(:,1) = round(validPointsTarget_board.Location(:,1)/2) + bbox(1);
            validPointsTarget_board.Location(:,2) = round(validPointsTarget_board.Location(:,2)/2) + bbox(2);

            break;
        elseif ismember(recognizedTextBoardBinary, validNumbers)
            ocr_board = recognizedTextBoardBinary;
            board_gray = grayImage;
            pointsTarget = detectSURFFeatures(board_gray,'MetricThreshold', 100);
            [h_target, w_target, ~] = size(board_gray);

            [featuresTarget_board, validPointsTarget_board] = extractFeatures(board_gray,pointsTarget);
            imagebox_board = validPointsTarget_board.Location;

            validPointsTarget_board.Location(:,1) = round(validPointsTarget_board.Location(:,1)/2) + bbox(1);
            validPointsTarget_board.Location(:,2) = round(validPointsTarget_board.Location(:,2)/2) + bbox(2);
            break;
        end

    end
end


% 데이터베이스 연결 및 이미지 데이터 가져오기
conn = database('image_matching', 'postgres', 'as7721', ...
    'Vendor', 'PostgreSQL', 'Server', 'localhost', 'PortNumber', 5432);
query = sprintf("SELECT * FROM image_paths WHERE door_num LIKE '%%%s%%' OR board_num LIKE '%%%s%%'", ocr_door, ocr_board);
imageData = fetch(conn, query);


% 추정 위치를 저장할 배열 초기화
estimatedPositions = [];
bestMatchImage = ''; % 가장 좋은 이미지 경로 저장
bestupdate = 0;      % 최대 내재 점 수 초기화


rule=0;
rule2= 1;
sim_width_del = 1000000000;

% --- 이미지 데이터 루프 ---
for k = 1:size(imageData,1)
    % 데이터베이스 이미지 및
    % 실제 위치 가져오기
    first= 1;
    option = 0;
    targetImagePath = imageData.image_path{k};
    realPosition = [imageData.real_x(k), imageData.real_y(k), imageData.real_z(k)];
    dbImage = imread(targetImagePath);
    dbImage = imrotate(dbImage, -90);

    clear combinedMatchedPointsRef_door combinedMatchedPointsRef_board combinedMatchedPointsTarget_door combinedMatchedPointsTarget_board  best_imagebox_door imagebox_board_match best_imagebox_board;

    % 데이터베이스 이미지에서 객체 검출
    [bboxesTarget, ~, labelsTarget] = detect(detector, dbImage, Threshold=0.1);
    % 참조 이미지에서 객체 검출 및 원하는 객체 선택

    for i = 1:size(bboxesTarget, 1)
        error_code = 0;

        label = labelsTarget(i);
        bbox = bboxesTarget(i, :);

        foundDoor = false;
        foundBoard = false;

        if strcmp(string(label), 'door') && strcmp(ocr_door, imageData.door_num{k})
            bboxDoor = bbox;

            croppedRegionDoor = imcrop(dbImage, bboxDoor);
            croppedDoorRefGray = rgb2gray(croppedRegionDoor);
            foundDoor = true;
        elseif strcmp(string(label), 'board') && strcmp(ocr_board, imageData.board_num{k})
            if first == 1
                bboxBoard = bbox;
                croppedRegionBoard = imcrop(dbImage, bboxBoard);
                [db_h, db_w, ~]= size(croppedRegionBoard);

                croppedBoardRefGray = rgb2gray(croppedRegionBoard);
                foundBoard = true;
                first = first + 1;
            end
        end


        % 특징점 검출 및 매칭 (door)
        if foundDoor
            pointsDoorRef = detectSURFFeatures(croppedDoorRefGray, 'MetricThreshold', 100);
            [featuresDoorRef, validPointsDoorRef] = extractFeatures(croppedDoorRefGray, pointsDoorRef);

            % 특징점 좌표를 원본 이미지 좌표계로 변환

            validPointsDoorRef.Location(:,1) = validPointsDoorRef.Location(:,1) + bboxDoor(1);
            validPointsDoorRef.Location(:,2) = validPointsDoorRef.Location(:,2) + bboxDoor(2);

            % door 매칭
            [indexPairsDoor, matchMetricDoor] = matchFeatures(featuresDoorRef, featuresTarget_door, 'MaxRatio', 0.9, 'MatchThreshold', 50);
            matchedPointsDoorRef = validPointsDoorRef(indexPairsDoor(:, 1), :);
            matchedPointsDoorTarget = validPointsTarget_door(indexPairsDoor(:, 2), :);
            imagebox_door_match = imagebox_door(indexPairsDoor(:, 2),:);
            % door 매칭점 합치기
            combinedMatchedPointsRef_door = matchedPointsDoorRef;
            combinedMatchedPointsTarget_door = matchedPointsDoorTarget;
        end

        % 특징점 검출 및 매칭 (board)
        if foundBoard

            croppedBoardRefGray = imresize(croppedBoardRefGray,2);
            pointsBoardRef = detectSURFFeatures(croppedBoardRefGray, 'MetricThreshold', 100);
            [featuresBoardRef, validPointsBoardRef] = extractFeatures(croppedBoardRefGray, pointsBoardRef);


            validPointsBoardRef.Location(:,1) = validPointsBoardRef.Location(:,1)/2 + bboxBoard(1);
            validPointsBoardRef.Location(:,2) = validPointsBoardRef.Location(:,2)/2 + bboxBoard(2);
            % board 매칭
            [indexPairsBoard, matchMetricBoard] = matchFeatures(featuresBoardRef, featuresTarget_board, 'MaxRatio', 0.9, 'MatchThreshold', 50);
            imagebox_board_match = imagebox_board(indexPairsBoard(:, 2),:);

            matchedPointsBoardRef = validPointsBoardRef(indexPairsBoard(:, 1), :);

            matchedPointsBoardTarget = validPointsTarget_board(indexPairsBoard(:, 2), :);
            % board의 매칭점 합치기
            combinedMatchedPointsRef_board = matchedPointsBoardRef;
            combinedMatchedPointsTarget_board = matchedPointsBoardTarget;
        end


        %합치기
        if exist('combinedMatchedPointsRef_door') && exist('combinedMatchedPointsRef_board')
            combinedMatchedPointsRef = vertcat(combinedMatchedPointsRef_door, combinedMatchedPointsRef_board);
            combinedMatchedPointsTarget = vertcat(combinedMatchedPointsTarget_door, combinedMatchedPointsTarget_board);


        elseif exist('combinedMatchedPointsRef_door') && ~exist('combinedMatchedPointsRef_board')
            combinedMatchedPointsRef = combinedMatchedPointsRef_door;
            combinedMatchedPointsTarget = combinedMatchedPointsTarget_door;
        elseif ~exist('combinedMatchedPointsRef_door') && exist('combinedMatchedPointsRef_board')

            combinedMatchedPointsRef = combinedMatchedPointsRef_board;
            combinedMatchedPointsTarget = combinedMatchedPointsTarget_board;
        end
        % door와 board 특징점 매칭 (매칭 결과 종합)
        best_world_pos = realPosition;

        try
            bestMatchImage = targetImagePath;
            if foundDoor
                best_imagebox_door = imagebox_door_match;
            elseif foundBoard
                best_imagebox_board = imagebox_board_match;
            end
            best_image_loc = combinedMatchedPointsTarget.Location;
            % 두 이미지 간 에피폴라 기하학 계산
            [E, inliers] = estimateEssentialMatrix(combinedMatchedPointsRef, ...
                combinedMatchedPointsTarget, cameraParams);

            % 에피폴라 기하학을 통해 회전 및 변환 벡터를 계산하여 두 카메라 간의 상대 위치 보정
            [relativeOrientation, relativeLocation] = relativeCameraPose(E, ...
                cameraParams, ...
                combinedMatchedPointsRef(inliers, :), ...
                combinedMatchedPointsTarget(inliers, :));

        catch

        end
    end


    if exist('best_world_pos')
        % 데이터베이스 연결 및 이미지 데이터 가져오기
        conn = database('image_matching', 'postgres', 'as7721', ...
            'Vendor', 'PostgreSQL', 'Server', 'localhost', 'PortNumber', 5432);
        query = sprintf("SELECT * FROM object_list WHERE door = 'O' and object_name LIKE '%%%s%%'", ocr_door);
        query2 = sprintf("SELECT * FROM object_list WHERE board = 'O' and object_name LIKE '%%%s%%'", ocr_board);

        ObjectData = fetch(conn, query);
        ObjectData2 = fetch(conn, query2);

        objectx = ObjectData.real_x;
        objecty = ObjectData.real_y;
        objectz = ObjectData.real_z;


        object2x = ObjectData2.real_x;
        object2y = ObjectData2.real_y;
        object2z = ObjectData2.real_z;

        if exist('best_imagebox_door') && size(ObjectData,1) > 0

            % 입력: 첫 번째 카메라의 위치, 내부 파라미터, 3D-2D 매칭점
            cameraPosition = best_world_pos; % 첫 번째 카메라의 위치 (알고 있는 값)


            realWorldCorners = [
                objectx, objecty, objectz+200;          % 좌상단
                objectx, objecty+80, objectz;          % 우상단
                objectx, objecty+80, objectz+200;          % 우하단
                objectx, objecty, objectz           % 좌하단
                ];



            % 참조 이미지에서의 모서리 좌표 (croppedRegionRef 기준)
            [heightRef, widthRef] = size(croppedRegionDoor);


            imageCornersRef = [
                1, 1;                 % 좌상단
                widthRef, 1;          % 우상단
                widthRef, heightRef;  % 우하단
                1, heightRef          % 좌하단
                ];


            % 매칭된 특징점들의 현실 좌표 계산
            xRatios = (best_imagebox_door(:,1) - imageCornersRef(1,1)) ./ (imageCornersRef(2,1) - imageCornersRef(1,1));
            yRatios = (best_imagebox_door(:,2) - imageCornersRef(1,2)) ./ (imageCornersRef(4,2) - imageCornersRef(1,2));
            interpY = realWorldCorners(1,2) + xRatios * (realWorldCorners(3,2) - realWorldCorners(1,2));
            interpZ = realWorldCorners(1,3) - yRatios * (realWorldCorners(3,3) - realWorldCorners(2,3));
            interpX = realWorldCorners(1,1) * ones(size(interpY));

            worldPoints = [interpX-3.5, -interpY+20, -interpZ];
            worldPoints = [worldPoints; [realWorldCorners(:,1)-3.5 -realWorldCorners(:,2)+20 -realWorldCorners(:,3)]];
            db_imagePoints = combinedMatchedPointsRef_door.Location;
            %imagePoints = best_image_loc;               % 첫 번째 이미지 상의 2D 매칭점 (Nx2 행렬)
            imagePoints = [best_image_loc;imageCornersRef];               % 첫 번째 이미지 상의 2D 매칭점 (Nx2 행렬)
            cameraMatrix = cameraParams.K;  % 첫 번째 카메라의 내부 파라미터 (3x3 행렬)

            % 매칭된 점들의 거리 배열 초기화
            ip_distances = [];
            wd_distances = [];

            for i = 1:size(xRatios, 1)-1
                % 각 매칭된 점 쌍에 대해 거리 계산
                db_ip_distance = norm(db_imagePoints(i,:) - db_imagePoints(i+1,:));
                db_wd_distance = norm(worldPoints(i,:) - worldPoints(i+1,:));

                % 거리 저장
                ip_distances = [ip_distances; db_ip_distance];
                wd_distances = [wd_distances; db_wd_distance];
            end

            % 평균 거리 계산
            average_ip_distance = mean(ip_distances);
            average_wd_distance = mean(wd_distances);

            % 스케일 계산
            correction_scale = average_wd_distance / average_ip_distance;

            try
                % PnP 문제를 해결하여 첫 번째 카메라의 회전 및 위치 추정
                tran = estworldpose(imagePoints, worldPoints, cameraParams.Intrinsics);
                result = [1 0 0; 0 -1 0; 0 0 -1]*(tran.Translation'+[3.5;-20;0]);
                total_result = result';
                % PnP 문제를 해결하여 첫 번째 카메라의 회전 및 위치 추정

                for i4 = 1:10
                    tran = estworldpose(imagePoints, worldPoints, cameraParams.Intrinsics);
                    result = [1 0 0; 0 -1 0; 0 0 -1]*(tran.Translation'+[3.5;-20;0]);

                    % result = [translationVector(1)+40 translationVector(3)
                    % -translationVector(2)-40]
                    total_result = [total_result;result';];
                end
                % 1사분위수(Q1)와 3사분위수(Q3) 계산
                Q1 = quantile(total_result, 0.25);
                Q3 = quantile(total_result, 0.75);
                % IQR 계산
                IQR = Q3 - Q1;

                % 상위 및 하위 25% 제거한 데이터 필터링
                final_result(1,1) = mean(total_result(total_result >= Q1(1) & total_result <= Q3(1)));
                final_result(1,2) = mean(total_result(total_result >= Q1(2) & total_result <= Q3(2)));
                final_result(1,3) = mean(total_result(total_result >= Q1(3) & total_result <= Q3(3)));
            catch
                error_code = 1;
            end

        elseif exist('best_imagebox_board')  && size(ObjectData2,1) > 0

            [heightRef2, widthRef2] = size(croppedRegionBoard);


            imageCornersRef2 = [
                1, 1;                 % 좌상단
                widthRef2, 1;          % 우상단
                widthRef2, heightRef2;  % 우하단
                1, heightRef2          % 좌하단
                ];

            realWorldCorners2 = [
                object2x, object2y, object2z+20;          % 좌상단
                object2x+20, object2y, object2z+20;          % 우상단
                object2x+20, object2y, object2z;          % 우하단
                object2x, object2y, object2z           % 좌하단
                ];

            %imagePoints2 = best_image_loc;
            imagePoints2 = [best_image_loc; imageCornersRef2];
            xRatios2 = (best_imagebox_board(:,1) - imageCornersRef2(1,1)) ./ (imageCornersRef2(2,1) - imageCornersRef2(1,1));
            yRatios2 = (best_imagebox_board(:,2) - imageCornersRef2(1,2)) ./ (imageCornersRef2(4,2) - imageCornersRef2(1,2));

            interpZ2 = realWorldCorners2(1,3) - yRatios2 * (realWorldCorners2(2,3) - realWorldCorners2(3,3));
            interpX2 = realWorldCorners2(1,1) + xRatios2 * (realWorldCorners2(3,1) - realWorldCorners2(1,1));
            interpY2 = realWorldCorners2(1,2) * ones(size(interpZ2));
            worldPoints2 = [interpX2-3.5+5, -interpY2+20, -interpZ2];
            worldPoints2 = [worldPoints2; [realWorldCorners2(:,1)-3.5 -realWorldCorners2(:,2)+20 -realWorldCorners2(:,3)]];

            % 매칭된 점들의 거리 배열 초기화
            ip_distances = [];
            wd_distances = [];
            db_imagePoints = combinedMatchedPointsRef_board.Location;

            for i = 1:size(xRatios2, 1)-1
                % 각 매칭된 점 쌍에 대해 거리 계산
                db_ip_distance = norm(db_imagePoints(i,:) - db_imagePoints(i+1,:));
                db_wd_distance = norm(worldPoints2(i,:) - worldPoints2(i+1,:));

                % 거리 저장
                ip_distances = [ip_distances; db_ip_distance];
                wd_distances = [wd_distances; db_wd_distance];
            end

            % 평균 거리 계산
            average_ip_distance = mean(ip_distances);
            average_wd_distance = mean(wd_distances);

            % 스케일 계산
            correction_scale = average_wd_distance / average_ip_distance;
            % 첫 번째 이미지 상의 2D 매칭점 (Nx2 행렬)
            cameraMatrix = cameraParams.K;  % 첫 번째 카메라의 내부 파라미터 (3x3 행렬)


            try
                tran2 = estworldpose(imagePoints2, worldPoints2, cameraParams.Intrinsics);
                result2 = [1 0 0; 0 -1 0; 0 0 -1]*(tran2.Translation'+[3.5;-20;0]);
                total_result2 = result2';
                % PnP 문제를 해결하여 첫 번째 카메라의 회전 및 위치 추정

                for i4 = 1:4
                    [tran2, inlierIdx, status] = estworldpose(imagePoints2, worldPoints2, cameraParams.Intrinsics);
                    result2 = [1 0 0; 0 -1 0; 0 0 -1]*(tran2.Translation'+[3.5;-20;0]);

                    % result = [translationVector(1)+40 translationVector(3)
                    % -translationVector(2)-40]
                    total_result2 = [total_result2;result2';];

                end
                % 1사분위수(Q1)와 3사분위수(Q3) 계산
                Q1 = quantile(total_result2, 0.25);
                Q3 = quantile(total_result2, 0.75);

                % 상위 및 하위 25% 제거한 데이터 필터링
                final_result2(1,1) = mean(total_result2(total_result2(:,1) >= Q1(1) & total_result2(:,1) <= Q3(1),1));
                final_result2(1,2) = mean(total_result2(total_result2(:,2) >= Q1(2) & total_result2(:,2) <= Q3(2),2));
                final_result2(1,3) = mean(total_result2(total_result2(:,3) >= Q1(3) & total_result2(:,3) <= Q3(3),3));
                std_result2 = std(total_result2);
                estimation_std2 = std_result2;  % 추정 정밀도 (표준편차)
            catch
                error_code = 1;
            end
        end

        if ~isempty(final_result) && isempty(final_result2) && error_code ==0

            final = final_result;
            rule = 1;

        elseif ~isempty(final_result2) && isempty(final_result)  && error_code ==0


            final = final_result2;
            rule = 1;

        elseif ~isempty(final_result2) && ~isempty(final_result) && error_code ==0

            final = final_result + final_result2;
            rule = 1;

        end

        if ~isempty(final)
            % 에피폴라 기하학 이동 벡터 단위 벡터화
            u_epi = relativeLocation(1,:)/ norm(relativeLocation(1,:));

            d_pnp = [final(1)-best_world_pos(1), final(2)-best_world_pos(2), final(3)-best_world_pos(3)];
            u_pnp = d_pnp / norm(d_pnp);

            cos_theta = dot(u_pnp,u_epi);

            % 기준 값
            threshold_value = 0.8;

            if cos_theta < threshold_value

                % 방향 벡터 계산
                correction_vector = (u_epi - u_pnp);  % 에피폴라 방향 - PnP 방향
                correction_vector = correction_vector / norm(correction_vector);  % 정규화
                % if cos_theta < 0.4
                % % 보정 크기 설정 (일반적으로 상황에 따라 조정 필요)
                % correction_scale = 100;  % 조정할 비율 (0~1 범위에서 적절히 설정)
                % elseif cos_theta >= 0.4
                % correction_scale = 10;  % 조정할 비율 (0~1 범위에서 적절히 설정)
                % end
                correction = [1 0 0; 0 -1 0; 0 0 -1]*correction_scale * (correction_vector'+[3.5;-20;0]);  % 보정 벡터에 스케일 적용

                correction_result = final + correction';
            end
            % 최종 결과 저장
            all_final_results = [all_final_results; final];
            if exist('correction_result')
                all_correction_result = [all_correction_result; correction_result];
            end


        end


        if  first == 2
            width_del = abs(db_h*db_w-w_target*h_target);
            if sim_width_del > width_del
                scale = (w_target*h_target)/(db_h*db_w);
                dbpath = targetImagePath;
                sim_width_del = width_del;
                final_x2 = realPosition(1);
                final_y2 = realPosition(2);
                final_z2 = realPosition(3);
                rule2 = 2;
            end
        end
    end
end

if rule == 1 && rule2 == 1
    option = 1;
    if size(all_final_results,1) > 3
        % 1사분위수(Q1)와 3사분위수(Q3) 계산
        Q1 = quantile(all_final_results, 0.3);
        Q3 = quantile(all_final_results, 0.8);

        Q1_c = quantile(all_correction_result, 0.3);
        Q3_c = quantile(all_correction_result, 0.8);
        % 상위 및 하위 25% 제거한 데이터 필터링
        final_x = mean(all_final_results(all_final_results(:, 1) >= Q1(1),1));
        final_y = mean(all_final_results(all_final_results(:, 2) >= Q1(2) & all_final_results(:, 2) <= Q3(2),2));
        final_z = mean(all_final_results(all_final_results(:, 3) >= Q1(3) & all_final_results(:, 3) <= Q3(3),3));


        final_cor_x = mean(all_correction_result(all_correction_result(:, 1) >= Q1_c(1),1));
        final_cor_y = mean(all_correction_result(all_correction_result(:, 2) >= Q1_c(2) & all_correction_result(:, 2) <= Q3_c(2),2));
        final_cor_z = mean(all_correction_result(all_correction_result(:, 3) >= Q1_c(3) & all_correction_result(:, 3) <= Q3_c(3),3));

        final_pos = [final_x final_y final_z];
        final_cor_pos = [final_cor_x final_cor_y final_cor_z];
    else

    end
elseif rule2 == 2 && rule == 0
    option = 2;

    final_pos = [final_x2 final_y2 final_z2];
    final_cor_pos = [0 0 0];
elseif rule2 == 2 && rule == 1
    option = 3;

    if size(all_final_results,1) > 3
        % 1사분위수(Q1)와 3사분위수(Q3) 계산
        Q1 = quantile(all_final_results, 0.3);
        Q3 = quantile(all_final_results, 0.8);

        Q1_c = quantile(all_correction_result, 0.3);
        Q3_c = quantile(all_correction_result, 0.8);

        % 상위 및 하위 25% 제거한 데이터 필터링
        final_x = mean(all_final_results(all_final_results(:, 1) >= Q1(1),1));
        final_y = mean(all_final_results(all_final_results(:, 2) >= Q1(2) & all_final_results(:, 2) <= Q3(2),2));
        final_z = mean(all_final_results(all_final_results(:, 3) >= Q1(3) & all_final_results(:, 3) <= Q3(3),3));


        final_cor_x = mean(all_correction_result(all_correction_result(:, 1) >= Q1_c(1),1));
        final_cor_y = mean(all_correction_result(all_correction_result(:, 2) >= Q1_c(2) & all_correction_result(:, 2) <= Q3_c(2),2));
        final_cor_z = mean(all_correction_result(all_correction_result(:, 3) >= Q1_c(3) & all_correction_result(:, 3) <= Q3_c(3),3));
    else

    end

    final_pos = [(final_x+final_x2)/2 (final_y+final_y2)/2 (final_z+final_z2)/2];
    final_cor_pos = [(final_cor_x+final_x2)/2 (final_cor_y+final_y2)/2 (final_cor_z+final_z2)/2];
else
    final_pos = [0 0 0];
    final_cor_pos = [0 0 0];
end

% 결과 변환: cm → m
final_cor_pos_m = final_cor_pos / 100; % cm → m

% 위도와 경도 계산
delta_lon_cor = final_cor_pos_m(1) / (111320 * cosd(origin_lat)); % 보정된 경도 변화
delta_lat_cor = final_cor_pos_m(2) / 111320; % 보정된 위도 변화

% 변환된 최종 위치 (WGS84)
final_lat_cor = origin_lat + delta_lat_cor;
final_lon_cor = origin_lon + delta_lon_cor;

% 결과를 구조체로 정리
result = struct();
result.final_cor_pos_wgs84 = [final_lat_cor, final_lon_cor, final_cor_pos_m(3)]; % 보정된 위치

% JSON 형태로 출력
fprintf('%s\n', jsonencode(result));

end
